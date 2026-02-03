// Supabase Edge Function para webhook conversacional de WhatsApp
// Deploy: npx supabase functions deploy whatsapp-webhook

// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // DEPRECATED
import { getSession, updateSession, clearSession, SessionData, BuilderState, CheckoutState } from './session.ts';
import { getProductWithSteps, getCategories, getAllProducts, getCategoryByName, getProductsByCategory, ProductTree, ProductStep } from './productService.ts';
import { interpretSelection, analyzeIntent, generateConversationalResponse } from './gemini.ts';

const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID")!;
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN")!;

// Types
export interface MessageContext {
    from: string;
    text: string;
    timestamp: number;
}

export interface BotResponse {
    text: string;
    useButtons?: boolean;
    buttons?: string[];
}

// WhatsApp Interactive Message Types
export interface ListMessage {
    header: string;
    body: string;
    footer?: string;
    buttonText: string;
    sections: Array<{
        title: string;
        rows: Array<{
            id: string;
            title: string;
            description?: string;
        }>;
    }>;
}

export interface ButtonMessage {
    body: string;
    footer?: string;
    buttons: Array<{
        id: string;
        title: string;
    }>;
}

const INTENTS: Record<string, string[]> = {
    greeting: ['hola', 'buenos días', 'hey', 'hi'],
    menu: ['menú', 'menu', 'carta'],
    help: ['ayuda', 'comandos'],
    hours: ['horario', 'abren'],
    location: ['ubicación', 'donde'],
};

async function handleBasicIntent(context: MessageContext): Promise<BotResponse | null> {
    const text = context.text.toLowerCase();

    // Check Menu - Send as List Message
    if (INTENTS.menu.some(k => text.includes(k))) {
        const success = await sendListMessage(context.from, {
            header: "🥗 Menú Yoko Poke",
            body: "¿Qué se te antoja hoy?",
            footer: "Yoko Poke",
            buttonText: "Ver opciones",
            sections: [{
                title: "Menú Principal",
                rows: [
                    { id: "armar_poke", title: "🥗 Armar un Poke", description: "Crea tu poke ideal" },
                    { id: "pokes_casa", title: "📋 Pokes de la Casa", description: "Recetas del chef" },
                    { id: "burgers", title: "🍔 Sushi Burgers", description: "Fusión única" }
                ]
            }]
        });

        if (success) return null; // Already sent

        // Fallback
        return {
            text: "🥗 *Menú Yoko*: \n\nSelecciona una opción para ver más:",
            useButtons: true,
            buttons: ['Ver Menú Completo', 'Armar un Poke', 'Sushi Burgers']
        };
    }

    // Default Greeting / Help (Main Menu)
    return {
        text: "¡Konnichiwa! 🎌 Bienvenido a *Yoko Poke* 🥣\n\nSoy *POKI*, tu asistente personal 🤖✨.\n\nEstoy aquí para tomar tu orden volando 🚀. Puedes pedirme lo que quieras por chat o ordenar muy rapido en nuestra pagina \n🌐 https://yokopoke.mx\n\n¿Qué se te antoja probar hoy? 🥢",
        useButtons: false
    };
}


/**
 * Logic for the step-by-step Poke Builder
 */
async function handleBuilderFlow(context: MessageContext, session: SessionData, aggregatedText: string): Promise<BotResponse> {
    if (!session.builderState) return { text: "Error de sesión." };

    const state = session.builderState;
    const product = await getProductWithSteps(state.productSlug);
    if (!product) {
        await clearSession(context.from);
        return { text: "El producto ya no está disponible. Volvamos al inicio." };
    }

    const currentStep = product.steps[state.stepIndex];
    // Use AGGREGATED text for processing
    const text = aggregatedText.trim();
    const lowerText = text.toLowerCase();

    // --- CHECK FOR EXIT COMMANDS ---
    if (lowerText.includes('cancelar') || lowerText.includes('salir') || lowerText.includes('menú principal') || lowerText === 'menu' || lowerText === 'menú') {
        await clearSession(context.from);
        return {
            text: "Entendido, pedido cancelado. Volviendo al menú principal.",
            useButtons: true,
            buttons: ['Menú', 'Armar un Poke', 'Sushi Burgers']
        };
    }

    // --- CURRENT SELECTIONS ---
    let currentSelections = state.selections[currentStep.id] || [];

    // --- CHECK FOR BUTTON ACTIONS ---
    const wantsToAddMore = text === 'agregar_mas';
    const isExplicitDone = (
        lowerText === 'listo' ||
        lowerText === 'siguiente' ||
        lowerText.includes('✅ listo') ||
        text === 'listo' // Button ID
    );

    // If user clicked "Agregar más", treat it as wanting to stay and see options
    // It will fall through to selection logic or STAY section

    // If user says "Listo", they want to advance - respect that choice
    // No minimum validation when explicitly done
    if (!isExplicitDone && !wantsToAddMore) {
        // --- INTERPRET INPUT (If not "listo") ---
        // Combine Direct Match logic with Gemini 
        let selectedIds: number[] = [];

        // 1. Direct match with current options (Name OR ID)
        currentStep.options.forEach(opt => {
            if (lowerText.includes(opt.name.toLowerCase()) || lowerText === opt.id.toString()) {
                if (!selectedIds.includes(opt.id)) selectedIds.push(opt.id);
            }
        });

        // 2. Ask Gemini for more complex interpretation
        const aiIds = await interpretSelection(text, currentStep.options);
        aiIds.forEach(id => {
            if (!selectedIds.includes(id)) selectedIds.push(id);
        });

        // --- UPDATE SELECTION (TOGGLE / ACCUMULATE) ---
        if (selectedIds.length > 0) {
            if (currentStep.max_selections === 1) {
                // REPLACE behavior for single select
                currentSelections = [selectedIds[selectedIds.length - 1]]; // Take last mention
            } else {
                // TOGGLE / ACCUMULATE
                selectedIds.forEach(id => {
                    if (currentSelections.includes(id)) {
                        // Toggle logic kept but prioritize ADD
                        if (currentSelections.includes(id)) {
                            currentSelections = currentSelections.filter(existing => existing !== id);
                        } else {
                            currentSelections.push(id);
                        }
                    } else {
                        currentSelections.push(id);
                    }
                });
            }
            state.selections[currentStep.id] = currentSelections;
            await updateSession(context.from, session);
        } else if (!isExplicitDone && text.length > 0) {
            // User typed something but we didn't understand
            const selectedNames = currentStep.options
                .filter(o => currentSelections.includes(o.id))
                .map(o => o.name)
                .join(', ');

            const optionsList = currentStep.options.map(o => {
                const extra = o.price_extra || 0;
                const price = extra > 0 ? ` (+$${extra})` : '';
                const check = currentSelections.includes(o.id) ? '✅ ' : '• ';
                return `${check}${o.name}${price}`;
            }).join('\n');

            return {
                text: `🤔 Hmm, no encontré "${text}" en las opciones disponibles.\n\n${selectedNames.length > 0 ? `✅ *Seleccionado*: ${selectedNames}\n\n` : ''}*Opciones para "${currentStep.label}":*\n${optionsList}\n\nEscribe el nombre de lo que quieres o "Listo" para continuar. 👇`,
                useButtons: true,
                buttons: ['✅ Listo']
            };
        }
    }

    // --- CHECK PROGRESS & DETERMINE RESPONSE ---
    let shouldAdvance = false;

    if (isExplicitDone) {
        // User explicitly wants to advance - always allow it
        shouldAdvance = true;
    } else if (currentStep.max_selections === 1 && currentSelections.length > 0) {
        shouldAdvance = true;
    }

    // --- DETERMINE NEXT STEP OR STAY ---
    if (!shouldAdvance) {
        //STAY ON STEP

        // FIX: If we have selections in multi-select and user didn't explicitly ask for list,
        // show BUTTONS ONLY to avoid loop confusion and redundant messages.
        if (currentStep.max_selections > 1 && currentSelections.length > 0 && !wantsToAddMore) {
            const selectedLabels = currentStep.options
                .filter(o => currentSelections.includes(o.id))
                .map(o => o.name).join(', ');

            await sendButtonMessage(context.from, {
                body: `${selectedLabels.length > 0 ? `✅ Llevas: ${selectedLabels}.\n` : ''}${currentSelections.length} seleccionado(s).\n¿Qué quieres hacer?`,
                buttons: [
                    { id: 'agregar_mas', title: '➕ Agregar más' },
                    { id: 'listo', title: '✅ Listo' }
                ]
            });
            return { text: "" };
        }
        const selectedNames = currentStep.options
            .filter(o => currentSelections.includes(o.id))
            .map(o => o.name);

        const remaining = currentStep.max_selections ? (currentStep.max_selections - currentSelections.length) : 'varios';

        // Generate summary of previous steps
        let stepsSummary = "";
        try {
            stepsSummary = product.steps
                .filter(s => state.selections[s.id] && state.selections[s.id].length > 0)
                .map(s => {
                    const stepNames = s.options
                        .filter(o => state.selections[s.id].includes(o.id))
                        .map(o => o.name)
                        .join(', ');
                    return `${s.label}: ${stepNames}`;
                })
                .join(' | ');
        } catch (e) {/* ignore */ }

        // Use AI to generate conversational update
        const conversationalText = await generateConversationalResponse(
            currentStep.label || '',
            selectedNames,
            'Siguiente',
            {
                included: currentStep.included_selections || 1,
                absolute: currentStep.max_selections || 'varios'
            },
            stepsSummary
        );

        // --- EXTRA COST WARNING ---
        let extraCostMsg = "";
        const included = currentStep.included_selections || 0;
        if (currentSelections.length > included) {
            const extrasCount = currentSelections.length - included;
            const extraTotal = extrasCount * (currentStep.price_per_extra || 0);
            if (extraTotal > 0) {
                extraCostMsg = `\n💰 Ojo: Llevas ${extrasCount} extra(s). +$${extraTotal}`;
            }
        }

        // --- BUILD LIST MESSAGE ---
        const stepIncluded = currentStep.included_selections || 0;
        const currentCount = currentSelections.length;
        const remainingIncluded = Math.max(0, stepIncluded - currentCount);

        // Determine if we can show "Next/Done" option
        const canAdvance = currentSelections.length > 0; // Simplified rule

        // Options List
        let listRows = currentStep.options.slice(0, 9).map(o => {
            const isSelected = currentSelections.includes(o.id);
            // Fix Pricing Display Logic
            let displayPrice = "";
            let baseExtra = currentStep.price_per_extra || 0;
            let optExtra = o.price_extra || 0;

            if (isSelected) {
                // If selected, check if it was one of the free ones
                const selectionIndex = currentSelections.indexOf(o.id);
                // Note: accurate selection index relies on order preservation which we fixed in calc logic
                // For display, we approximate.
                if (selectionIndex < stepIncluded) {
                    // Covered by included. Only show if logic implies paying premium?
                    // Usually included covers Everything unless explicit rule. 
                    // Let's hide price if included to be cleaner.
                } else {
                    const total = baseExtra + optExtra;
                    if (total > 0) displayPrice = `+$${total}`;
                }
            } else {
                // Not selected
                if (remainingIncluded > 0) {
                    // Start consuming included slots
                    // If included covers base price, we only show premium extra
                    if (optExtra > 0) displayPrice = `+$${optExtra}`;
                } else {
                    // Consumes extra slot
                    const total = baseExtra + optExtra;
                    if (total > 0) displayPrice = `+$${total}`;
                }
            }

            const prefix = isSelected ? '✅ ' : '';
            return {
                id: o.id.toString(),
                title: `${prefix}${o.name}`.substring(0, 24),
                description: displayPrice
            };
        });

        // Add "Next" Option if applicable
        if (canAdvance) {
            const isLastStep = state.stepIndex === product.steps.length - 1;
            const nextLabel = isLastStep ? "✅ TERMINAR" : "➡️ SIGUIENTE";
            const nextDesc = isLastStep ? "Finalizar armado" : "Ir al siguiente paso";

            listRows.unshift({ // Add to TOP for visibility
                id: "listo",
                title: nextLabel,
                description: nextDesc
            });
        }

        // Build header with selections
        let header = `${product.name}`;
        if (selectedNames.length > 0) {
            header = `✅ ${selectedNames.length} seleccionado(s)`;
        }

        // Build body
        let body = conversationalText;
        if (extraCostMsg) body += extraCostMsg;
        if (remainingIncluded > 0) {
            body += `\n\n${remainingIncluded} más GRATIS`;
        }

        // Build rows variable for sendListMessage (using the listRows we just built, but cleaning properties)
        // Wait, listRows already has structure {id, title, description}.
        // The previous code had a redundant 'const rows =' block. I will use listRows directly but need to match section format.

        // Try sending List Message
        const success = await sendListMessage(context.from, {
            header,
            body: body.substring(0, 1024),
            footer: "Yoko Poke",
            buttonText: `Ver ${currentStep.label}`,
            sections: [{
                title: currentStep.label || 'Opciones',
                rows: listRows.slice(0, 10) // Max 10 rows
            }]
        });

        // Fallback to text if List failed
        if (!success) {
            const optionsList = currentStep.options.map(o => {
                // Simplified fallback text logic
                const check = currentSelections.includes(o.id) ? '✅ ' : '• ';
                return `${check}${o.name}`;
            }).join('\n');

            return {
                text: `${conversationalText}${extraCostMsg}\n\n*Elige para "${currentStep.label}":* (Incluye: ${stepIncluded})\n${optionsList}\n\nEscribe tu elección o "Listo" para continuar. 👇`,
                useButtons: false
            };
        }

        // List sent successfully - check if multi-selection and has selections
        if (currentStep.max_selections && currentStep.max_selections > 1 && selectedNames.length > 0) {
            // Send follow-up buttons for multi-selection
            const isLastStep = state.stepIndex === product.steps.length - 1;
            const doneBtn = isLastStep ? '✅ Terminar' : '➡️ Siguiente';

            await sendButtonMessage(context.from, {
                body: `${selectedNames.length} seleccionado(s).\n¿Qué quieres hacer?`,
                buttons: [
                    { id: 'agregar_mas', title: '➕ Agregar más' },
                    { id: 'listo', title: doneBtn }
                ]
            });
        }

        return { text: "" }; // Already sent via List Message
    }

    // --- MOVE NEXT ---
    const nextIndex = state.stepIndex + 1;

    if (nextIndex < product.steps.length) {
        state.stepIndex = nextIndex;
        await updateSession(context.from, session);

        const nextStep = product.steps[nextIndex];

        // AI Conversational transition
        const prevSelectedNames = currentStep.options
            .filter(o => currentSelections.includes(o.id))
            .map(o => o.name);

        const conversationalText = await generateConversationalResponse(
            currentStep.label || '',
            prevSelectedNames,
            nextStep.label || '',
            {
                included: nextStep.included_selections || 1,
                absolute: nextStep.max_selections || 'varios'
            }
        );

        // Send next step as List Message
        const nextIncluded = nextStep.included_selections || 0;

        // Build rows with pricing
        const rows = nextStep.options.map(o => {
            let displayPrice = "";
            let baseExtra = nextStep.price_per_extra || 0;
            let optExtra = o.price_extra || 0;

            if (nextIncluded > 0) {
                if (optExtra > 0) displayPrice = `+$${optExtra}`;
            } else {
                const totalExtra = baseExtra + optExtra;
                if (totalExtra > 0) displayPrice = `+$${totalExtra}`;
            }

            return {
                id: o.id.toString(),
                title: o.name.substring(0, 24),
                description: displayPrice || undefined
            };
        });

        // Try sending List Message
        const success = await sendListMessage(context.from, {
            header: `${product.name}`,
            body: `${conversationalText}\n\n${nextIncluded > 0 ? `${nextIncluded} incluido(s)` : ''}`.substring(0, 1024),
            footer: "Yoko Poke",
            buttonText: `Ver ${nextStep.label}`,
            sections: [{
                title: nextStep.label || 'Opciones',
                rows: rows.slice(0, 10)
            }]
        });

        // Fallback to text if List failed
        if (!success) {
            const optionsList = nextStep.options.map(o => {
                let displayPrice = "";
                let baseExtra = nextStep.price_per_extra || 0;
                let optExtra = o.price_extra || 0;

                if (nextIncluded > 0) {
                    if (optExtra > 0) displayPrice = ` (+$${optExtra})`;
                } else {
                    const totalExtra = baseExtra + optExtra;
                    if (totalExtra > 0) displayPrice = ` (+$${totalExtra})`;
                }
                return `• ${o.name}${displayPrice}`;
            }).join('\n');

            return {
                text: `${conversationalText}\n\n*Opciones de ${nextStep.label}:* (Incluye: ${nextIncluded})\n${optionsList}\n\nEscribe tu elección 👇`,
                useButtons: false
            };
        }

        return { text: "" }; // Already sent via List Message
    } else {
        // --- ALL STEPS FINISHED - START CHECKOUT ---
        const { total, summary, items } = calculateOrderDetails(product, state.selections);

        // Transition to CHECKOUT mode
        session.mode = 'CHECKOUT';
        session.checkoutState = {
            productSlug: state.productSlug,
            selections: state.selections,
            totalPrice: total,
            checkoutStep: 'COLLECT_NAME'
        };
        delete session.builderState;
        await updateSession(context.from, session);

        return {
            text: `🎉 ¡Excelente! Tu ${product.name} está casi listo.\n\nAntes de enviarlo a cocina, necesito algunos datos:\n\n👤 *¿Cuál es tu nombre?*`,
            useButtons: false
        };
    }
}

function calculateOrderDetails(product: ProductTree, selections: Record<number, number[]>) {
    let total = product.base_price;
    let summary = `*${product.name}* ($${product.base_price})`;
    const itemsJson: any = {
        name: product.name,
        productType: product.type || 'bowl',
        base_price: product.base_price
    };

    product.steps.forEach(step => {
        const selectedOptionIds = selections[step.id] || [];
        const included = step.included_selections || 0;

        // Fix: Map IDs to options to preserve SELECTION ORDER (Critical for pricing)
        // This ensures the first 'included' items selected by user are the free ones.
        const selectedOptions = selectedOptionIds
            .map(id => step.options.find(o => o.id === id))
            .filter((o): o is any => !!o);

        if (selectedOptions.length > 0) {
            summary += `\n\n*${step.label}:*`;

            // Map for JSON Item
            const stepKey = (step.label?.toLowerCase() || step.name) || '';
            if (stepKey.includes('base')) itemsJson.base = selectedOptions[0];
            else if (stepKey.includes('prot')) itemsJson.proteins = selectedOptions;
            else if (stepKey.includes('salsa')) itemsJson.sauce = selectedOptions[0];
            else {
                if (!itemsJson.extras) itemsJson.extras = [];
                itemsJson.extras.push(...selectedOptions);
            }

            selectedOptions.forEach((opt, idx) => {
                const isFree = idx < included;
                let priceLine = `\n- ${opt.name}`;
                if (!isFree) {
                    const extra = (step.price_per_extra || 0) + (opt.price_extra || 0);
                    if (extra > 0) {
                        total += extra;
                        priceLine += ` (+$${extra})`;
                    }
                }
                summary += priceLine;
            });
        }
    });

    return { total, summary, items: [itemsJson] };
}

/**
 * Main Logic
 */
export async function processMessage(from: string, text: string): Promise<void> {
    /* DEBOUNCE LOGIC WITH FAST PASS EXCEPTION */
    let session = await getSession(from);
    const now = Date.now();
    const lowerText = text.toLowerCase();

    // ⚡ FAST PASS & BUILDER CHECK
    // Priority 1: Instant Keywords (Sales, Greetings & Colloquial)
    // Pass session to verify if we are in BUILDER mode (to avoid hijacking context)
    const instantResponse = await handleInstantKeywords(from, lowerText, session);
    if (instantResponse) {
        console.log(`⚡ Fast Pass: Keyword Match for ${from}`);
        await sendWhatsApp(from, instantResponse);

        // Reset Strategies if needed (e.g. for Armar Poke)
        if (lowerText.includes('armar') && lowerText.includes('poke')) {
            await clearSession(from);
        }

        // Clean buffer leftovers
        if (session.bufferUntil) {
            session.pendingMessages = [];
            session.bufferUntil = 0;
            await updateSession(from, session);
        }
        return;
    }

    // Initialize if needed
    if (!session.pendingMessages) session.pendingMessages = [];

    // DIRECT PROCESSING (Buffer Removed by User Request)
    const aggregatedText = text;
    console.log(`🔥 Processing instantly: "${aggregatedText}"`);

    // Reset buffer vars just in case
    session.pendingMessages = [];
    session.bufferUntil = 0;

    // --- BUILDER FLOW (Buffered) ---
    if (session.mode === 'BUILDER' && session.builderState) {
        console.log(`🏗 Processing Builder Flow for ${from} (Buffered)`);
        const response = await handleBuilderFlow({ from, text: aggregatedText, timestamp: now }, session, aggregatedText);
        await sendWhatsApp(from, response);
        return;
    }

    // --- CHECKOUT FLOW ---
    if (session.mode === 'CHECKOUT' && session.checkoutState) {
        console.log(`💳 Processing Checkout Flow for ${from}`);
        const { handleCheckoutFlow } = await import('./checkout.ts');
        const response = await handleCheckoutFlow(from, aggregatedText, session);

        // Clear session if checkout completed or cancelled
        if (response.text.includes('ORDEN CONFIRMADA') || response.text.includes('cancelada')) {
            await clearSession(from);
        } else {
            await updateSession(from, session);
        }

        await sendWhatsApp(from, response);
        return;
    }

    // AI SALES / FALLBACK logic
    const prodService = await import('./productService.ts');
    const menuContext = await prodService.getMenuContext();
    const allProducts = await prodService.getAllProducts();

    // ANALYZE INTENT
    const geminiResponse = await import('./gemini.ts').then(m => m.analyzeIntent(aggregatedText));
    console.log("🧠 Intent:", geminiResponse.intent);

    let response: BotResponse;

    if (geminiResponse.intent === 'START_BUILDER') {
        const slug = geminiResponse.entities?.size_preference === 'grande' ? 'poke-grande' : 'poke-mediano';
        await startBuilder(from, slug);
        return;
    } else if (geminiResponse.intent === 'CATEGORY_FILTER' && geminiResponse.entities?.category_keyword) {
        const kw = geminiResponse.entities.category_keyword;
        const cats = await prodService.getCategories();
        const match = cats.find(c => c.name.toLowerCase().includes(kw.toLowerCase()) || (c.slug && c.slug.includes(kw.toLowerCase())));
        if (match) {
            const products = await prodService.getProductsByCategory(match.id);
            const list = products.slice(0, 5).map(p => `• ${p.name} ($${p.base_price})`).join('\n');
            response = {
                text: `📂 *${match.name} found:*\n\n${list}\n\n¿Te sirvo algo de aquí?`,
                useButtons: true,
                buttons: products.slice(0, 3).map(p => p.name)
            };
        } else {
            const salesRes = await import('./gemini.ts').then(m => m.generateSalesResponse(aggregatedText, menuContext, allProducts));
            response = { text: salesRes.text, useButtons: salesRes.suggested_actions && salesRes.suggested_actions.length > 0, buttons: salesRes.suggested_actions?.slice(0, 3) };
        }
    } else {
        const salesRes = await import('./gemini.ts').then(m => m.generateSalesResponse(aggregatedText, menuContext, allProducts));
        response = {
            text: salesRes.text,
            useButtons: salesRes.suggested_actions && salesRes.suggested_actions.length > 0,
            buttons: salesRes.suggested_actions?.slice(0, 3)
        };
        if (salesRes.show_image_url) await sendWhatsAppImage(from, salesRes.show_image_url, "");
    }

    await sendWhatsApp(from, response);
}

/**
 * FAST PASS HELPER
 */
async function handleInstantKeywords(from: string, text: string, session: any): Promise<BotResponse | null> {
    const lowerText = text.toLowerCase();

    // ⚡ PRIORITY 1: FLOW TRIGGER (Armar Poke) - ALWAYS ALLOW THIS TO RESET
    if (lowerText.includes('armar clásico') || lowerText.includes('armar clasico') || (lowerText.includes('armar') && lowerText.includes('poke'))) {
        console.log("🌊 Triggering Builder (List Mode) for:", text);

        /* 
        // FLOW DISABLED: Meta Integrity Check Fails
        const flowId = "1380671310524592"; 
        if (flowId) {
            const success = await sendFlowMessage(from, flowId, "SIZE_SELECTION", "Armar Poke");
            if (success) return { text: "" };
        }
        */

        // Standard List Message Logic (Primary)
        const success = await sendListMessage(from, {
            header: "🥗 Arma tu Poke Perfecto",
            body: "Elige el tamaño de tu Poke Clásico:",
            footer: "Yoko Poke",
            buttonText: "Ver tamaños",
            sections: [{
                title: "Tamaños disponibles",
                rows: [
                    {
                        id: "poke-mediano",
                        title: "Poke Mediano 🥗",
                        description: "$120 - 1 proteína"
                    },
                    {
                        id: "poke-grande",
                        title: "Poke Grande 🍱",
                        description: "$140 - 1 proteína"
                    }
                ]
            }]
        });

        if (!success) {
            return {
                text: "¡Va! ¿De qué tamaño lo quieres? 🥣",
                useButtons: true,
                buttons: ['Poke Mediano', 'Poke Grande']
            };
        }

        return { text: "" }; // HANDLED
    }

    // 0. If in Builder Mode (and NOT resetting), DISABLE other Fast Pass triggers
    if (session && session.mode === 'BUILDER') return null;

    // 1. Generic Poke Triggers (Menu Choice)
    // Supports: "armar clásico", "armar poke", "quiero armar un poke"


    // 1. Generic Poke Triggers (Menu Choice)
    const pokeTriggers = ['quiero', 'dame', 'un'];

    // Check generic "Quiero un poke" -> Offer Choice
    if (
        (lowerText.includes('poke') && pokeTriggers.some(t => lowerText.includes(t))) ||
        lowerText === 'poke' ||
        lowerText === 'pokes'
    ) {
        return {
            text: "¿Cómo se te antoja tú Poke hoy? 🤔\n\n🥣 *Clásico*: Tú eliges cada ingrediente (Arroz, proteína, mix...).\n📄 *De la Casa*: Recetas especiales del chef listas para disfrutar.",
            useButtons: true,
            buttons: ['Armar Clásico', 'Pokes de la Casa']
        };
    }

    // 2. Handle Choice: "Armar Clásico" -> Flow
    if (lowerText.includes('armar clásico') || lowerText.includes('armar clasico') || (lowerText.includes('armar') && lowerText.includes('poke'))) {

        // Try Flow first if configured
        const flowId = "1380671310524592"; // Hardcoded ID from user
        if (flowId) {
            const success = await sendFlowMessage(from, flowId, "SIZE_SELECTION", "Armar Poke");
            if (success) return null;
        }

        // Fallback to List Message logic
        const success = await sendListMessage(from, {
            header: "🥗 Arma tu Poke Perfecto",
            body: "Elige el tamaño de tu Poke Clásico:",
            footer: "Yoko Poke",
            buttonText: "Ver tamaños",
            sections: [{
                title: "Tamaños disponibles",
                rows: [
                    {
                        id: "poke-mediano",
                        title: "Poke Mediano 🥗",
                        description: "$120 - 1 proteína"
                    },
                    {
                        id: "poke-grande",
                        title: "Poke Grande 🍱",
                        description: "$140 - 1 proteína"
                    }
                ]
            }]
        });

        // If List Message failed, fallback to buttons
        if (!success) {
            return {
                text: "¡Va! ¿De qué tamaño lo quieres? 🥣",
                useButtons: true,
                buttons: ['Poke Mediano', 'Poke Grande']
            };
        }

        return { text: "" }; // HANDLED: Stop further processing
    }

    // ... (rest of function)

    // 3. Handle Choice: "Pokes de la Casa" -> List Bowls
    if (lowerText.includes('pokes de la casa') || lowerText.includes('de la casa') || lowerText.includes('pokes_casa')) {
        const prodService = await import('./productService.ts');
        const categories = await prodService.getCategories();
        const bowlCat = categories.find(c => c.slug === 'bowls' || c.name.toLowerCase().includes('pokes') || c.name.toLowerCase().includes('bowls'));

        if (bowlCat) {
            const products = await prodService.getProductsByCategory(bowlCat.id);

            // Send as List Message
            const success = await sendListMessage(from, {
                header: "📋 Pokes de la Casa",
                body: "Recetas especiales del chef.\nSelecciona tu favorito:",
                footer: "Yoko Poke",
                buttonText: "Ver pokes",
                sections: [{
                    title: "Recetas del Chef",
                    rows: products.slice(0, 10).map(p => ({
                        id: p.slug || p.id.toString(),
                        title: p.name.substring(0, 24),
                        description: `$${p.base_price}`
                    }))
                }]
            });

            if (success) return null;

            // Fallback
            const list = products.slice(0, 5).map(p => `🍲 ${p.name} - $${p.base_price}`).join('\n');
            return {
                text: `*Pokes de la Casa (Recetas del Chef):*\n\n${list}\n\nEscribe el nombre del que quieras pedir:`,
                useButtons: true,
                buttons: products.slice(0, 3).map(p => p.name)
            };
        }
    }

    // 4. Direct Size (Text OR List ID)
    if (['poke mediano', 'poke grande', 'poke-mediano', 'poke-grande'].includes(lowerText)) {
        const slug = lowerText.includes('mediano') ? 'poke-mediano' : 'poke-grande';

        // RESET SESSION to ensure we start fresh
        await clearSession(from);

        await startBuilder(from, slug);
        return { text: "" }; // HANDLED
    }

    // 5. Greetings + Colloquial
    const colloquial = ['bro', 'hermano', 'papi', 'bb', 'nn', 'buenas', 'que tal', 'qué tal', 'onda', 'pedir', 'ordenar', 'menu', 'menú'];
    if (
        INTENTS.greeting.some(k => text.includes(k)) ||
        colloquial.some(k => text.includes(k)) ||
        text.includes('hola')
    ) {
        const response = await handleBasicIntent({ from, text, timestamp: 0 });
        if (response) return response;
        return null;
    }

    // 6. Burgers - Convert to List Message
    if (text.includes('burger') || text.includes('hamburguesa') || text.includes('burgers')) {
        const prodService = await import('./productService.ts');
        const categories = await prodService.getCategories();
        const burgerCat = categories.find(c => c.slug === 'burgers');
        if (burgerCat) {
            const products = await prodService.getProductsByCategory(burgerCat.id);

            // Send as List Message
            const success = await sendListMessage(from, {
                header: "🍔 Sushi Burgers",
                body: "Nuestra fusión única.\n¿Cuál quieres probar?",
                footer: "Yoko Poke",
                buttonText: "Ver burgers",
                sections: [{
                    title: "Sushi Burgers",
                    rows: products.slice(0, 10).map(p => ({
                        id: p.slug || p.id.toString(),
                        title: p.name.substring(0, 24),
                        description: `$${p.base_price}`
                    }))
                }]
            });

            if (success) return null;

            // Fallback
            const list = products.slice(0, 3).map(p => `🍔 ${p.name} - $${p.base_price}`).join('\n');
            return {
                text: `*Sushi Burgers:*\n\n${list}\n\nSelecciona una:`,
                useButtons: true,
                buttons: products.slice(0, 3).map(p => p.name)
            };
        }
    }

    return null;
}

// --- FLOW HELPER ---
async function sendFlowMessage(to: string, flowId: string, screen: string, cta: string) {
    const payload = {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
            type: "flow",
            header: { type: "text", text: "🥗 Arma tu Poke" },
            body: { text: "¡Crea tu combinación perfecta en segundos!" },
            footer: { text: "Yoko Poke" },
            action: {
                name: "flow",
                parameters: {
                    mode: "draft", // Change to "published" in production
                    flow_message_version: "3",
                    flow_token: "unused",
                    flow_id: flowId,
                    flow_cta: cta,
                    flow_action: "navigate",
                    flow_action_payload: {
                        screen: screen
                    }
                }
            }
        }
    };

    const res = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        console.error("Error sending flow:", await res.text());
        return false;
    }
    return true;
}


// --- HELPER WRAPPERS ---

async function startBuilder(from: string, slug: string) {
    console.log(`🏗 Starting builder for ${slug}`);

    const product = await getProductWithSteps(slug);
    if (!product) {
        await sendWhatsAppText(from, "Error: Producto no encontrado. :(");
        return;
    }

    const newSession: SessionData = {
        mode: 'BUILDER',
        lastInteraction: Date.now(),
        builderState: {
            productSlug: slug,
            stepIndex: 0,
            selections: {},
            totalPrice: 0
        },
        pendingMessages: [],
        bufferUntil: 0
    };
    await updateSession(from, newSession);

    const firstStep = product.steps[0];

    // Try sending as List Message
    const success = await sendListMessage(from, {
        header: `Tu ${product.name} 🥗`,
        body: `Primero, elige la ${firstStep.label}:`,
        footer: "Yoko Poke",
        buttonText: `Ver ${firstStep.label}`,
        sections: [{
            title: firstStep.label || 'Opciones',
            rows: firstStep.options.slice(0, 10).map(o => ({ // Max 10 rows
                id: o.id.toString(),
                title: o.name.substring(0, 24),
                description: (o.price_extra && o.price_extra > 0) ? `+$${o.price_extra}` : undefined
            }))
        }]
    });

    // Fallback to text if List failed
    if (!success) {
        const optionsList = firstStep.options.map(o => `• ${o.name}`).join('\n');
        const response = {
            text: `¡Excelente! Vamos a armar tu *${product.name}*.\n\nPrimero: *${firstStep.label}*\n\n${optionsList}`,
            useButtons: firstStep.max_selections !== 1,
            buttons: firstStep.max_selections !== 1 ? ['✅ Listo'] : undefined
        };
        await sendWhatsApp(from, response);
    }
}

export async function sendWhatsApp(to: string, response: BotResponse) {
    if (response.useButtons && response.buttons && response.buttons.length > 0) {
        await sendWhatsAppButtons(to, response.text, response.buttons);
    } else {
        await sendWhatsAppText(to, response.text);
    }
}

async function sendWhatsAppText(to: string, message: string) {
    await fetch(
        `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: to,
                type: "text",
                text: { body: message }
            }),
        }
    );
}

async function sendWhatsAppButtons(to: string, message: string, buttons: string[]) {
    await fetch(
        `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: to,
                type: "interactive",
                interactive: {
                    type: "button",
                    body: { text: message },
                    action: {
                        buttons: buttons.map((btn, idx) => ({
                            type: "reply",
                            reply: {
                                id: `btn_${idx}`,
                                title: btn.substring(0, 20)
                            }
                        }))
                    }
                }
            }),
        }
    );
}

/**
 * Send WhatsApp List Message (Interactive UI - No verification needed)
 */
async function sendListMessage(to: string, list: ListMessage) {
    try {
        const payload = {
            messaging_product: "whatsapp",
            to,
            type: "interactive",
            interactive: {
                type: "list",
                header: { type: "text", text: list.header.substring(0, 60) }, // Max 60 chars
                body: { text: list.body.substring(0, 1024) }, // Max 1024 chars
                ...(list.footer && { footer: { text: list.footer.substring(0, 60) } }),
                action: {
                    button: list.buttonText.substring(0, 20), // Max 20 chars
                    sections: list.sections.map(section => ({
                        title: section.title.substring(0, 24), // Max 24 chars
                        rows: section.rows.map(row => ({
                            id: row.id,
                            title: row.title.substring(0, 24), // Max 24 chars
                            ...(row.description && { description: row.description.substring(0, 72) }) // Max 72 chars
                        }))
                    }))
                }
            }
        };

        console.log("📤 Sending List Message:", JSON.stringify(payload, null, 2));
        const response = await fetch(
            `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        const responseText = await response.text();
        console.log("📥 Meta Response:", response.status, responseText);

        if (!response.ok) {
            console.error('List Message failed:', responseText);
            throw new Error('List message send failed');
        }

        return true;
    } catch (error) {
        console.error('sendListMessage error:', error);
        // Fallback to text
        return false;
    }
}

/**
 * Send WhatsApp Button Message (Reply Buttons - No verification needed)
 */
async function sendButtonMessage(to: string, msg: ButtonMessage) {
    try {
        const payload = {
            messaging_product: "whatsapp",
            to,
            type: "interactive",
            interactive: {
                type: "button",
                body: { text: msg.body.substring(0, 1024) },
                ...(msg.footer && { footer: { text: msg.footer.substring(0, 60) } }),
                action: {
                    buttons: msg.buttons.slice(0, 3).map(b => ({ // Max 3 buttons
                        type: "reply",
                        reply: {
                            id: b.id,
                            title: b.title.substring(0, 20) // Max 20 chars
                        }
                    }))
                }
            }
        };

        const response = await fetch(
            `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('Button Message failed:', error);
            throw new Error('Button message send failed');
        }

        return true;
    } catch (error) {
        console.error('sendButtonMessage error:', error);
        return false;
    }
}

async function sendWhatsAppImage(to: string, imageUrl: string, caption: string) {
    await fetch(
        `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: to,
                type: "image",
                image: {
                    link: imageUrl,
                    caption: caption
                }
            }),
        }
    );
}

// --- SERVER ---
if (import.meta.main) {
    Deno.serve(async (req: Request) => {
        console.log("🔔 INCOMING WEBHOOK REQUEST", req.method, req.url);
        if (req.method === 'GET') {
            const url = new URL(req.url);
            if (url.searchParams.get('hub.verify_token') === WHATSAPP_VERIFY_TOKEN) {
                return new Response(url.searchParams.get('hub.challenge'), { status: 200 });
            }
            return new Response('Forbidden', { status: 403 });
        }

        try {
            const body = await req.json();
            if (body.object && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
                const message = body.entry[0].changes[0].value.messages[0];
                let text = "";

                if (message.type === 'text') {
                    text = message.text.body;
                } else if (message.type === 'interactive') {
                    if (message.interactive.type === 'button_reply') {
                        text = message.interactive.button_reply.id;
                    } else if (message.interactive.type === 'list_reply') {
                        text = message.interactive.list_reply.id;
                    } else if (message.interactive.type === 'nfm_reply') {
                        try {
                            const responseJson = JSON.parse(message.interactive.nfm_reply.response_json);
                            console.log("🌸 FLOW RESPONSE:", responseJson);

                            const runtime = (globalThis as any).EdgeRuntime;
                            if (runtime) {
                                runtime.waitUntil(handleFlowResponse(message.from, responseJson));
                            } else {
                                await handleFlowResponse(message.from, responseJson);
                            }
                            return new Response('EVENT_RECEIVED', { status: 200 });
                        } catch (e) { console.error("Flow parse error", e); }
                    }
                }

                if (text) {
                    console.log(`🤖 Processing text: "${text}"`);
                    const runtime = (globalThis as any).EdgeRuntime;
                    if (runtime) {
                        runtime.waitUntil(processMessage(message.from, text));
                    } else {
                        await processMessage(message.from, text);
                    }
                }
            }
            return new Response('EVENT_RECEIVED', { status: 200 });
        } catch (error: any) {
            console.error('SERVER ERROR:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
    });
}

// --- FLOW RESPONSE HANDLER ---
async function handleFlowResponse(from: string, flowData: any) {
    if (!flowData) return;

    // 1. Create Session in Checkout Mode
    const session = await getSession(from);

    // Parse Payload
    const total = parseFloat(flowData.total || "0");
    const summary = flowData.summary || "Orden de Flow";
    const customerName = flowData.customer_name || "Cliente";
    const deliveryMethod = flowData.delivery_method || "pickup";

    // Update Session
    session.mode = 'CHECKOUT';
    session.checkoutState = {
        productSlug: 'flow-custom-order', // Generic slug
        selections: {}, // Flow handled the selections
        totalPrice: total,
        checkoutStep: 'CONFIRMATION', // Skip name collection as Flow did it
        flowData: flowData // Store raw data for reference
    };

    // We already have the Name and Delivery Method from the Flow! 
    // So we can jump straight to Confirmation or even Place Order if payment isn't required yet.
    // Let's go to confirmation.

    session.checkoutState.customerName = customerName;
    session.checkoutState.deliveryMethod = deliveryMethod;

    await updateSession(from, session);

    // 2. Send Confirmation Message
    const methodText = deliveryMethod === 'delivery' ? '🚗 Envío a domicilio' : '🏪 Recoger en tienda';

    const confirmText = `✅ *¡Orden Recibida desde Flow!* 🌸\n\n` +
        `👤 *Cliente:* ${customerName}\n` +
        `📝 *Pedido:* ${summary}\n` +
        `💰 *Total:* $${total}\n` +
        `🚚 *Método:* ${methodText}\n\n` +
        `¿Todo es correcto?`;

    await sendWhatsAppButtons(from, confirmText, ['✅ Confirmar', '❌ Cancelar']);
}

