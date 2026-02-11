// Supabase Edge Function para webhook conversacional de WhatsApp
// Deploy: npx supabase functions deploy whatsapp-webhook

// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // DEPRECATED
import { getSession, updateSession, clearSession, SessionData, BuilderState, CheckoutState } from './session.ts';
import { getProductWithSteps, getCategories, getAllProducts, getCategoryByName, getProductsByCategory, ProductTree, ProductStep } from './productService.ts';
import { interpretSelection, analyzeIntent, generateConversationalResponse } from './gemini.ts';
import { createClient } from "npm:@supabase/supabase-js@2";
import { getBusinessHours } from './configService.ts';

const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID")!;
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    useList?: boolean;
    listData?: ListMessage;
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
        // Return null to let main flow handle it (avoid duplicates at line 760-783)
        return null;
    }

    // Personalized Greeting (Premium UX)
    try {
        const { getOrderHistory } = await import('./orderHistoryService.ts');
        const { generatePersonalizedGreeting } = await import('./gemini.ts');

        const history = await getOrderHistory(context.from, 5);
        const greeting = await generatePersonalizedGreeting(context.from, history as any);

        return {
            text: greeting + "\n\n🌐 https://yokopoke.mx",
            useButtons: true,
            buttons: ['Ver Menú']
        };
    } catch (e) {
        console.error("Error generating personalized greeting:", e);
        // Fallback Greeting
        return {
            text: "¡Konnichiwa! 🎌 Bienvenido a *Yoko Poke* 🥣\n\nSoy *POKI*, tu asistente personal 🤖✨.\n\nEstoy aquí para tomar tu orden volando 🚀. Puedes pedirme lo que quieras por chat o ordenar en nuestra página \n🌐 https://yokopoke.mx\n\n¿Qué se te antoja probar hoy? 🥢",
            useButtons: true,
            buttons: ['Ver Menú']
        };
    }
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

    // --- HUMAN MODE (The "Pausa" Button) ---
    const lowerText = text.toLowerCase().trim();

    // 1. Activation (Resume)
    if (lowerText === 'reanudar' || lowerText === 'bot' || lowerText === 'activar' || lowerText === 'modo bot') {
        if (session.mode === 'PAUSED') {
            session.mode = 'NORMAL';
            session.pausedUntil = undefined;
            await updateSession(from, session);
            await sendWhatsApp(from, { text: "▶️ ¡Hola de nuevo! El Bot está activo. 🤖" });
            return;
        }
    }

    // 2. Deactivation (Pause)
    if (lowerText === 'pausa' || lowerText === 'agente' || lowerText === 'humano' || lowerText === 'silencio') {
        if (session.mode !== 'PAUSED') {
            session.mode = 'PAUSED';
            session.pausedUntil = now + (3600 * 1000); // 1 hour safety timeout
            await updateSession(from, session);
            await sendWhatsApp(from, { text: "⏸️ Bot pausado. Un humano te atenderá pronto. (Escribe 'Bot' para reactivarme)." });
            return;
        }
    }

    // 3. Silence Check
    if (session.mode === 'PAUSED') {
        console.log(`🤐 Ignored message from ${from} (Bot Paused)`);
        return;
    }
    // --- RATE LIMITING (God Level Safety) ---
    // Protect against spam/DDOS (Max 20 msgs/min)
    const rateNow = Date.now();
    if (!session.rateLimit) {
        session.rateLimit = { points: 20, lastReset: rateNow };
    }
    // Refill bucket every 60s
    if (rateNow - session.rateLimit.lastReset > 60000) {
        session.rateLimit.points = 20;
        session.rateLimit.lastReset = rateNow;
    }
    // Consume Token
    if (session.rateLimit.points <= 0) {
        console.warn(`🛑 Rate Limit HIT for ${from}. Ignoring.`);
        return;
    }
    session.rateLimit.points--;
    // Persist limit state immediately
    await updateSession(from, session);


    // --- BUSINESS HOURS CHECK (Premium UX) ---
    try {
        const { open, close } = await getBusinessHours();
        const comitenTime = new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' });
        const comitenDate = new Date(comitenTime);
        const currentHour = comitenDate.getHours();

        const isOpen = currentHour >= open && currentHour < close;

        if (!isOpen) {
            console.log(`🔒 Restaurant closed (${currentHour}:00, Open: ${open}-${close}) for ${from}`);

            // Exception: Pre-Order intent or explicit "Sí"
            const isPreOrderIntent = lowerText.match(/\b(sí|si|ordenar|pedir|quiero|armar)\b/);

            // Allow basic info queries? User said "el bot responde que estamos fuera de servicio pero si quiere le puede tomar la orden"
            // So we ALWAYS show closed message UNLESS they are confirming the order?
            // "peo si es antes de las 2, el bot responde que estamos fuera de servicio"
            // "pero si quiere le puede tomar la orden" -> "Escribe Sí"

            if (isPreOrderIntent) {
                // Pass through to standard flow (Checkout/Ordering)
            } else {
                const openTimeStr = `${open > 12 ? open - 12 : open}:00 ${open >= 12 ? 'PM' : 'AM'}`;
                await sendWhatsApp(from, {
                    text: `😴 *¡Shhh! Los ingredientes están durmiendo...* 🐟💤\n\nEstamos cerrados en este momento.\nHorario: *${openTimeStr} - ${close > 12 ? close - 12 : close}:00 PM*.\n\n✨ *¿Quieres dejar tu pedido listo?*\nPuedo tomar tu orden ahora y la cocinamos en cuanto abramos. �\n\n➡️ Escribe *"Sí"* para comenzar.`
                });
                return;
            }
        }
    } catch (e) {
        console.error("Error checking business hours:", e);
        // Continue normally if timezone check fails
    }

    // ⚡ FAST PASS & BUILDER CHECK
    // Priority 1: Instant Keywords (Sales, Greetings & Colloquial)

    // --- 0. SESSION TIMEOUT CHECK (2 HOURS) ---
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const timeSinceLast = now - (session.lastInteraction || 0);

    // If session is old (> 2 hours), reset it and treat as fresh
    if (session.lastInteraction > 0 && timeSinceLast > TWO_HOURS_MS) {
        console.log(`⏰ Session expired for ${from}. Resetting...`);
        await clearSession(from);
        session = await getSession(from); // Reload fresh session

        // Force Greeting for expired session
        const greeting = await handleBasicIntent({ from, text, timestamp: now });
        if (greeting) {
            await sendWhatsApp(from, greeting);
            await updateSession(from, { ...session, lastInteraction: now });
            return;
        }
    }
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

    // --- ROBUST CONCURRENCY (Senior Implementation) ---
    // 1. Add to DB Queue securely
    if (!session.pendingMessages) session.pendingMessages = [];
    session.pendingMessages.push({
        text: text,
        type: 'text', // Simplification: Primary text flow
        timestamp: Date.now()
    });

    // 2. Watchdog: Break Stale Locks (>30s)
    if (session.isProcessing && session.processingStart && (Date.now() - session.processingStart > 30000)) {
        console.warn(`🐕 Watchdog: Breaking stale lock for ${from}`);
        session.isProcessing = false;
    }

    // 3. Check Lock (Non-blocking return)
    if (session.isProcessing) {
        console.log(`🔒 Session locked for ${from}. Queued message.`);
        await updateSession(from, session);
        return;
    }

    // 4. Acquire Lock
    session.isProcessing = true;
    session.processingStart = Date.now();
    await updateSession(from, session);

    // 5. Short Debounce (Allow rapid-fire messages to accumulate)
    await new Promise(r => setTimeout(r, 1500));

    // 6. Fetch Aggregate Payload
    let workSession = await getSession(from);
    const queue = workSession.pendingMessages || [];

    // Sort by timestamp (FIFO)
    queue.sort((a, b) => a.timestamp - b.timestamp);

    // Filter duplicates (De-bounce)
    const uniqueQueue = queue.filter((item, index, self) =>
        index === 0 || item.text !== self[index - 1].text
    );

    // Join Texts
    const aggregatedText = uniqueQueue.map(q => q.text).join(". ");

    console.log(`🔥 Processing Batch (${uniqueQueue.length}): "${aggregatedText}"`);

    // 7. Clear Queue but Keep Lock
    workSession.pendingMessages = [];
    workSession.lastInteraction = Date.now();

    // Pass control to main logic with updated session
    session = workSession;
    // session.isProcessing is still true, will be cleared at end of logic


    // --- DETERMINISTIC ROUTER (THE "CEREBELLUM") ---
    try {
        // A. MODE-BASED ROUTING (Highest Priority)
        // If we are in a specific mode, we stay there until explicitly exited.

        // 1. BUILDER MODE
        if (session.mode === 'BUILDER' && session.builderState) {
            console.log(`🏗 Processing Builder Flow for ${from}`);
            const response = await handleBuilderFlow({ from, text: aggregatedText, timestamp: now }, session, aggregatedText);
            await sendWhatsApp(from, response);
        }

        // 2. CHECKOUT MODE
        else if (session.mode === 'CHECKOUT' && session.checkoutState) {
            console.log(`💳 Processing Checkout Flow for ${from}`);

            // Check for Exit Keywords
            if (aggregatedText.toLowerCase().includes('cancelar') || aggregatedText.toLowerCase().includes('salir')) {
                await clearSession(from);
                await sendWhatsApp(from, { text: "🚫 Checkout cancelado. ¿Qué se te antoja ahora?" });
                return;
            }

            const { handleCheckoutFlow } = await import('./checkout.ts');
            const response = await handleCheckoutFlow(from, aggregatedText, session);

            // Clear session if checkout completed or cancelled
            if (response.text.includes('ORDEN CONFIRMADA') || response.text.includes('cancelada')) {
                await clearSession(from);
            } else {
                await updateSession(from, session);
            }

            await sendWhatsApp(from, response);
        }

        // B. GENERAL AI / KEYWORD LOGIC (Normal Mode)
        // Only reaches here if NOT in a special mode.
        else {
            // ... (Fallthrough to existing AI logic below) ...

            // --- IGNORE INTERNAL BUTTON IDS ---
            // If text starts with 'btn_', it's an unhandled button click from a flow we might not have caught.
            // Or it might be a race condition. AI shouldn't try to answer "btn_0".
            if (text.startsWith('btn_')) {
                console.log(`🤖 Ignoring internal button ID: ${text}`);
                return;
            }

            const prodService = await import('./productService.ts');

            // --- CATEGORY SELECTION HANDLER (cat_ID) ---
            if (text.startsWith('cat_')) {
                console.log("📂 Category Selected:", text);
                const catIdStr = text.replace('cat_', '');
                const catId = parseInt(catIdStr);

                if (!isNaN(catId)) {
                    const products = await prodService.getProductsByCategory(catId);
                    const categories = await prodService.getCategories();
                    const currentCat = categories.find(c => c.id === catId);
                    const catName = currentCat ? currentCat.name : "Productos";

                    console.log(`🔎 LOOKUP: CatID=${catId}, FoundCat=${currentCat?.name} (ID: ${currentCat?.id}), ProductsFound=${products.length}`);
                    if (products.length === 0) {
                        // Debug: what categories DO we have?
                        console.log("DEBUG: All Categories:", JSON.stringify(categories));
                        // Debug: check all products to see if any match this category ID?
                        const allProds = await prodService.getAllProducts();
                        // Filter manually to see if DB query is being weird or strict
                        const matching = allProds.filter(p => p.category_id === catId);
                        console.log(`DEBUG: JS Filter Check - Products with category_id=${catId}: ${matching.length}`);
                        console.log("DEBUG: Sample Product:", JSON.stringify(allProds[0]));
                    }

                    if (products.length > 0) {
                        // Build Product List
                        const rows = products.slice(0, 10).map(p => ({
                            id: `${p.name}`, // Use Name for seamless AI flow
                            title: p.name.substring(0, 24),
                            description: `$${p.base_price} - ${p.description ? p.description.substring(0, 60) : ''}`
                        }));

                        console.log(`📜 Sending List for Category: ${catName}, Rows: ${rows.length}`);

                        await sendListMessage(from, {
                            header: `📂 ${catName}`,
                            body: `Aquí tienes nuestros ${catName}. ¿Cuál se te antoja?`,
                            footer: "Yoko Poke",
                            buttonText: "Ver Productos",
                            sections: [{
                                title: catName,
                                rows: rows
                            }]
                        });
                        return;
                    } else {
                        console.log(`⚠️ ERROR: No products found for category ${catName} (ID: ${catId})`);

                        // Deep Debug: Output Category ID map
                        const allProds = await prodService.getAllProducts();
                        const debugMap = allProds.map(p => `[${p.id}] ${p.name} -> CatID: ${p.category_id}`).join('\n');
                        console.log("DEBUG: Full Product Map:\n" + debugMap);

                        // Proactive Fix: Find products with similar name to category?
                        if (catName.toLowerCase().includes('burger')) {
                            const candidates = allProds.filter(p => p.name.toLowerCase().includes('burger'));
                            console.log("DEBUG: Products with 'Burger' in name:", JSON.stringify(candidates.map(c => ({ id: c.id, name: c.name, cat_id: c.category_id }))));
                        }

                        await sendWhatsApp(from, { text: `Lo siento, por ahora no hay productos en ${catName}.` });
                        return;
                    }
                }
            }

            const menuContext = await prodService.getMenuContext();
            const allProducts = await prodService.getAllProducts();

            // ANALYZE INTENT with CART Context
            let geminiResponse: any;
            try {
                geminiResponse = await import('./gemini.ts').then(m => m.analyzeIntent(aggregatedText, [], session.cart || []));
            } catch (e) {
                console.error("⚠️ AI Brain Freeze (Intent):", e);
                geminiResponse = { intent: 'CHAT' }; // Fallback to safe chat/menu
            }
            console.log("🧠 Intent:", geminiResponse.intent);

            // --- PRIORITY: MENU & CATEGORIES ---
            if (geminiResponse.intent === 'CATEGORY_FILTER') {
                const cats = await prodService.getCategories();
                let targetCategory = null;

                // 1. Specific Category Requested? (e.g. "Ver Bebidas")
                if (geminiResponse.category_keyword) {
                    const keyword = geminiResponse.category_keyword.toLowerCase();
                    // Fuzzy match
                    targetCategory = cats.find(c => c.name.toLowerCase().includes(keyword) || keyword.includes(c.name.toLowerCase()));
                }

                if (targetCategory) {
                    console.log(`📂 Specific Category Intent: "${targetCategory.name}"`);
                    const products = await prodService.getProductsByCategory(targetCategory.id);

                    if (products.length > 0) {
                        const rows = products.slice(0, 10).map(p => ({
                            id: `${p.name}`,
                            title: p.name.substring(0, 24),
                            description: `$${p.base_price} - ${p.description ? p.description.substring(0, 60) : ''}`
                        }));

                        // Friendly Messages Map
                        const catLower = targetCategory.name.toLowerCase();
                        let friendlyBody = `Aquí tienes nuestros ${targetCategory.name}. ¿Cuál se te antoja?`;

                        if (catLower.includes('bebida')) friendlyBody = "¡Claro! 🥤 Enseguida te paso nuestras bebidas refrescantes:";
                        else if (catLower.includes('postre')) friendlyBody = "¡El toque dulce perfecto! 🍰 Aquí están nuestros postres:";
                        else if (catLower.includes('entrada')) friendlyBody = "¡Para ir abriendo apetito! 🥟 Mira nuestras entradas:";
                        else if (catLower.includes('poke')) friendlyBody = "¡Excelentes opciones! 🥗 Aquí tienes nuestros Pokes favoritos:";
                        else if (catLower.includes('burger')) friendlyBody = "¡Uff, buena elección! 🍔 Checa nuestras Sushi Burgers:";

                        await sendListMessage(from, {
                            header: `📂 ${targetCategory.name}`,
                            body: friendlyBody,
                            footer: "Yoko Poke",
                            buttonText: "Ver Opciones",
                            sections: [{
                                title: targetCategory.name,
                                rows: rows
                            }]
                        });
                        return;
                    }
                }

                // 2. Fallback: Generic Menu (Category List)
                console.log("📂 Intent is MENU/CATEGORY -> Sending Category List");
                const rows = [
                    { id: "armar_poke", title: "🥗 Armar un Poke", description: "Crea tu poke ideal" }
                ];
                cats.forEach(c => {
                    rows.push({
                        id: `cat_${c.id}`,
                        title: `${c.name}`,
                        description: c.description ? c.description.substring(0, 60) : "Ver productos"
                    });
                });

                await sendListMessage(from, {
                    header: "🥗 Menú Yoko Poke",
                    body: "¿Qué se te antoja hoy? Selecciona una categoría:",
                    footer: "Yoko Poke",
                    buttonText: "Ver Categorías",
                    sections: [{
                        title: "Nuestro Menú",
                        rows: rows.slice(0, 10)
                    }]
                });
                return; // STOP HERE.
            }

            // Legacy fallthrough for keyword matching if AI fails but text has keywords
            else if (aggregatedText.toLowerCase().includes('menu') || aggregatedText.toLowerCase().includes('menú')) {
                // ... handled by above if AI is smart, but keeping as fallback if AI says 'CHAT' but user said 'Menu' logic is weird.
                // Actually, if AI says CHAT for "Quiero ver el menú", sales response might handle it or we should force category filter.
                // START_BUILDER or CHECKOUT handled separately.
                // Let's rely on Sales Agent for generic "Menu" in textual conversation if not CATEGORY_FILTER.
                // But strictly, if user types "Menu", we want the list. 

                // Let's execute the GENERIC MENU logic again here to be safe
                console.log("📂 Keyword 'Menu' detected -> Sending Category List");
                const cats = await prodService.getCategories();
                const rows = [
                    { id: "armar_poke", title: "🥗 Armar un Poke", description: "Crea tu poke ideal" }
                ];
                cats.forEach(c => {
                    rows.push({
                        id: `cat_${c.id}`,
                        title: `${c.name}`,
                        description: c.description ? c.description.substring(0, 60) : "Ver productos"
                    });
                });

                await sendListMessage(from, {
                    header: "🥗 Menú Yoko Poke",
                    body: "¿Qué se te antoja hoy? Selecciona una categoría:",
                    footer: "Yoko Poke",
                    buttonText: "Ver Categorías",
                    sections: [{
                        title: "Nuestro Menú",
                        rows: rows.slice(0, 10)
                    }]
                });
                return;
            } else if (geminiResponse.intent === 'CHECKOUT') {
                // --- CHECKOUT INIT ---
                console.log("💳 Intent is CHECKOUT -> Starting Checkout Flow");

                // Initialize Checkout from Cart if available
                let initialTotal = 0;
                let selections = {};
                // If cart exists, maybe we can convert it to checkout state? 
                // For now, keeping simple structure, but logically we should migrate cart -> checkout
                if (session.cart) {
                    initialTotal = session.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                }

                session.mode = 'CHECKOUT';
                session.checkoutState = {
                    productSlug: 'custom-order',
                    selections: {},
                    totalPrice: initialTotal,
                    checkoutStep: 'COLLECT_NAME',
                    // TODO: Move cart items to checkoutState.items (This requires schema update in session.ts checkoutState, currently simplified)
                };
                await updateSession(from, session);

                const response = {
                    text: `¡Excelente! El total es $${initialTotal}. Para tomar tu pedido, ¿a qué nombre lo registro? 📝`
                };
                await sendWhatsApp(from, response);
                return;
            } else if (geminiResponse.intent === 'START_BUILDER') {
                // Direct Sale - Let Sales Response handle it but ensure it doesn't redirect
                const salesRes = await import('./gemini.ts').then(m => m.generateSalesResponse(aggregatedText, menuContext, allProducts, session.cart || []));
                const response = {
                    text: salesRes.text,
                    useButtons: salesRes.suggested_actions && salesRes.suggested_actions.length > 0,
                    buttons: salesRes.suggested_actions?.slice(0, 2) // MAX 2 BUTTONS
                };
                if (salesRes.show_image_url) await sendWhatsAppImage(from, salesRes.show_image_url, "");
                await sendWhatsApp(from, response);
            } else {
                // GENERAL CHAT / SALES
                let salesRes;
                try {
                    salesRes = await import('./gemini.ts').then(m => m.generateSalesResponse(aggregatedText, menuContext, allProducts, session.cart || []));
                } catch (e) {
                    console.error("⚠️ AI Brain Freeze (Sales):", e);
                    // FALLBACK RESPONSE (Emergency Generator)
                    salesRes = {
                        text: "¡Hola! Se me trabó un poco el cable, pero aquí estoy. 🤖\n¿Quieres ver nuestro menú?",
                        suggested_actions: ["Ver Menú"],
                        useList: false
                    };
                }

                // --- HANDLE SERVER ACTIONS (ADD TO CART) with REALITY CHECK ---
                // --- HANDLE SERVER ACTIONS (ADD TO CART) with REALITY CHECK ---
                if (salesRes.server_action && salesRes.server_action.type === 'ADD_TO_CART') {
                    console.log("🛒 Executing ADD_TO_CART:", salesRes.server_action.product);

                    const requestedId = salesRes.server_action.product.id;
                    const requestedName = salesRes.server_action.product.name;

                    // REALITY CHECK: Does this product actually exist?
                    // Use loose equality for ID to handle string/number mismatch
                    let realProduct = allProducts.find(p => String(p.id) === String(requestedId) || p.slug === requestedId);

                    // If not found by ID/Slug, fuzzy search by Name
                    if (!realProduct && requestedName) {
                        realProduct = allProducts.find(p => p.name.toLowerCase().includes(requestedName.toLowerCase()));
                    }

                    if (realProduct) {
                        if (!session.cart) session.cart = [];

                        session.cart.push({
                            id: String(realProduct.id || realProduct.slug), // Ensure String
                            name: realProduct.name,
                            price: realProduct.base_price, // Ensure correct price from DB
                            quantity: salesRes.server_action.product.quantity || 1
                        });
                        // Save immediately
                        await updateSession(from, session);
                        console.log(`✅ Validated & Added to Cart: ${realProduct.name} ($${realProduct.base_price})`);
                    } else {
                        console.warn(`🛑 BLOCKED Hallucinated Product: ${requestedName} (ID: ${requestedId})`);
                        // Optionally inform user or just let the chat continue.
                    }
                }

                // --- NEW: LIST MESSAGE SUPPORT ---
                if (salesRes.useList && salesRes.listData && salesRes.listData.rows.length > 0) {
                    console.log("📜 Sending List Message Response");

                    // Limit to 10 items (WhatsApp Max)
                    const rows = salesRes.listData.rows.slice(0, 10).map(r => ({
                        id: r.id || r.title.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                        title: r.title.substring(0, 24), // Max 24 chars allowed by WhatsApp for Title
                        description: r.description?.substring(0, 72) || "" // Max 72 chars
                    }));

                    await sendListMessage(from, {
                        header: "Menú Yoko Poke",
                        body: salesRes.text || "Selecciona una opción del menú:",
                        footer: "Toca el botón para ver más 👇",
                        buttonText: "Ver Opciones",
                        sections: [
                            {
                                title: salesRes.listData.title || "Productos",
                                rows: rows
                            }
                        ]
                    });
                    // Stop here, list sent
                } else {
                    // Fallback to text/buttons
                    const response = {
                        text: salesRes.text,
                        useButtons: salesRes.suggested_actions && salesRes.suggested_actions.length > 0,
                        buttons: salesRes.suggested_actions?.slice(0, 2) // MAX 2 BUTTONS
                    };
                    if (salesRes.show_image_url) await sendWhatsAppImage(from, salesRes.show_image_url, "");
                    await sendWhatsApp(from, response);
                }
            }
        }

        // RELEASE LOCK
        session.isProcessing = false;
        session.activeThreadId = undefined;
        await updateSession(from, session);

    } catch (error) {
        // RELEASE LOCK ON ERROR TOO
        session.isProcessing = false;
        session.activeThreadId = undefined;
        await updateSession(from, session);

        console.error("🔥 FATAL BOT ERROR:", error);
        await sendWhatsApp(from, { text: "😰 Ups, tuve un pequeño mareo. ¿Me lo repites por favor?" });
    }
}

/**
 * FAST PASS HELPER
 */
async function handleInstantKeywords(from: string, text: string, session: any): Promise<BotResponse | null> {
    const lowerText = text.toLowerCase();

    // ⚡ PRIORITY 1: FLOW TRIGGER (Armar Poke) - REDIRECT TO WEB
    if (lowerText.includes('armar clásico') || lowerText.includes('armar clasico') || (lowerText.includes('armar') && lowerText.includes('poke'))) {
        console.log("🌊 Triggering Web Redirect for Armar Poke");

        return {
            text: "🥗 *¡Armar tu Poke es toda una experiencia!* ✨\n\nPara elegir cada ingrediente a tu gusto y verlo en tiempo real, entra a nuestro *Constructor Interactivo* aquí:\n\n👉 https://yokopoke.mx/#product-selector\n\n¡Es súper fácil y rápido! 🚀",
            useButtons: true,
            buttons: ['Ver Menú de la Casa']
        };
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
        // REDIRECT TO WEB
        return {
            text: "🥗 *¡Excelente elección!* ✨\n\nPara personalizar tu Poke justo como te gusta, entra a nuestro *Constructor Interactivo* aquí:\n\n👉 https://yokopoke.mx/#product-selector\n\n¡Ahí puedes elegir cada ingrediente! 🚀",
            useButtons: true,
            buttons: ['Ver Menú de la Casa']
        };
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

// --- RETRY UTILITY ---
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 500): Promise<Response> {
    try {
        const response = await fetch(url, options);
        if (!response.ok && retries > 0) {
            const status = response.status;
            // Retry on Server Errors (5xx) or Rate Limits (429)
            if (status >= 500 || status === 429) {
                console.warn(`⚠️ API Request Failed (${status}). Retrying in ${backoff}ms... (${retries} left)`);
                await new Promise(r => setTimeout(r, backoff));
                return fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
        }
        return response;
    } catch (error) {
        if (retries > 0) {
            console.warn(`⚠️ Network Error: ${error}. Retrying in ${backoff}ms... (${retries} left)`);
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw error;
    }
}

async function sendWhatsAppText(to: string, message: string) {
    try {
        await fetchWithRetry(
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
    } catch (e) {
        console.error("Failed to send text message after retries:", e);
    }
}

async function sendWhatsAppButtons(to: string, message: string, buttons: string[]) {
    try {
        await fetchWithRetry(
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
    } catch (e) {
        console.error("Failed to send button message after retries:", e);
    }
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

        const response = await fetchWithRetry(
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
            console.error('List Message failed:', error);
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

        const response = await fetchWithRetry(
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
    try {
        await fetchWithRetry(
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
    } catch (e) {
        console.error("Failed to send image after retries", e);
    }
}

// --- AUTOMATION: CRON JOBS ---
// Run daily at 14:00 CDMX (20:00 UTC)
Deno.cron("Notify Pre-Orders Daily", "0 20 * * *", async () => {
    console.log("⏰ Running Automated Pre-Order Notification (20:00 UTC / 14:00 CDMX)");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const result = await notifyPreOrders(supabase);
    console.log("✅ Cron Job Finished:", result);
});

async function notifyPreOrders(supabase: any) {
    console.log("🔔 Triggering Pre-Order Notifications...");

    // 1. Get correct date in Mexico City
    const mxFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const todayMX = mxFormatter.format(new Date());

    // 2. Fetch Orders
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pre_order')
        .gte('created_at', `${todayMX}T00:00:00`)
        .lte('created_at', `${todayMX}T23:59:59`);

    if (error) {
        console.error("🔥 DB Error:", error);
        return { success: false, error: error.message };
    }

    let successful = 0;
    let failed = 0;

    if (orders && orders.length > 0) {
        for (const order of orders) {
            try {
                // Notify
                await sendWhatsApp(order.phone, {
                    text: `👋 ¡Hola *${order.customer_name}*! 🌞\n\n📢 *YA ABRIMOS Y TU ORDEN ESTÁ EN MARCHA* 🍳\n\nNuestra cocina ya recibió tu pedido pre-ordenado.\n\n✅ *Status:* Confirmado y cocinando.\n⏳ *Tiempo estimado:* 30-40 mins.\n\nSi necesitas cambiar algo, avísanos en los próximos 5 mins. ¡Gracias! 🥢`
                });

                // Update Status
                const { error: updateError } = await supabase
                    .from('orders')
                    .update({ status: 'pending' })
                    .eq('id', order.id);

                if (updateError) throw updateError;
                successful++;
            } catch (e: any) {
                console.error(`❌ Failed processing ${order.id}:`, e.message);
                failed++;
            }
        }
    }

    return {
        success: true,
        date: todayMX,
        processed: successful,
        failed: failed
    };
}

// --- SERVER ENTRY POINT (The "Gateway") ---
// Critical: Must always return 200 OK to Meta to prevent retries/bans,
// unless it's a verification request.

Deno.serve(async (req: Request) => {
    // --- ADMIN ACTION: NOTIFY PRE-ORDERS ---
    {
        const url = new URL(req.url);
        if (url.searchParams.get('action') === 'notify_preorders' && url.searchParams.get('secret') === 'yoko_master_key') {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
            // Reuse logic
            const result = await notifyPreOrders(supabase);

            if (!result.success) {
                return new Response(JSON.stringify({ error: result.error }), { status: 500, headers: { "Content-Type": "application/json" } });
            }

            return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
        }
    }
    // 1. HEALTH CHECK / VERIFICATION
    if (req.method === "GET") {
        const url = new URL(req.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
            console.log("✅ Webhook Verified");
            return new Response(challenge, { status: 200 });
        } else {
            console.error("❌ Verification Failed. Token:", token);
            return new Response("Forbidden", { status: 403 });
        }
    }

    // 2. INCOMING MESSAGE PROCESSING
    try {
        const body = await req.json();

        // Validate Payload Structure
        if (!body.object || !body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            // Not a message (maybe status update), ignore gracefully
            return new Response("EVENT_RECEIVED", { status: 200 });
        }

        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from; // Phone number

        // --- 0. IDEMPOTENCY CHECK (God Level) ---
        // Prevent double-processing if Meta retries the webhook
        try {
            const { claimMessageId } = await import('./idempotencyService.ts');
            const isNew = await claimMessageId(message.id);
            if (!isNew) {
                console.warn(`♻️ Duplicate Message Skipped: ${message.id}`);
                return new Response("DUPLICATE_HANDLED", { status: 200 });
            }
        } catch (e) {
            console.error("Idempotency Check Failed, proceeding anyway:", e);
        }

        console.log(`📨 Message from ${from}: ${message.type}`);

        // 3. HAND OFF TO BACKGROUND WORKER
        // We return 200 OK immediately to Meta, and process logic in background.
        // This is CRITICAL for handling Audio/AI which might take > 5s.

        const runtime = (globalThis as any).EdgeRuntime;
        const processTask = async () => {
            try {
                // --- 1. KILL SWITCH (Feature Flag) ---
                try {
                    const { isMaintenanceMode } = await import('./configService.ts');
                    if (await isMaintenanceMode()) {
                        console.warn("🛑 Maintenance Mode Active. Stopping.");
                        await sendWhatsApp(from, { text: "🔧 Estamos en mantenimiento para mejorar tu experiencia. Volvemos en unos minutos. 👷‍♂️" });
                        return;
                    }
                } catch (e) {
                    console.error("Config Check Error:", e);
                }

                let text = "";

                // --- EXTRACT CONTENT ---
                if (message.type === 'text') {
                    text = message.text.body;
                }
                else if (message.type === 'audio') {
                    // 🎤 VOICE NOTE SUPPORT
                    console.log(`🎤 Receiving Audio: ${message.audio.id}`);
                    try {
                        const { downloadMedia } = await import('./mediaService.ts');
                        const { transcribeAudio } = await import('./gemini.ts');

                        // 1. Download
                        const media = await downloadMedia(message.audio.id);
                        if (media) {
                            // 2. Transcribe
                            text = await transcribeAudio(media);
                            console.log(`📝 Transcription: "${text}"`);
                            if (!text) {
                                await sendWhatsApp(from, { text: "🙉 Escuché ruido pero no entendí. ¿Podrías escribirlo?" });
                            }
                        } else {
                            console.error("Audio download failed");
                            await sendWhatsApp(from, { text: "⚠️ No pude descargar tu audio. ¿Me lo escribes?" });
                        }
                    } catch (e) {
                        console.error("Audio processing error:", e);
                    }
                }
                else if (message.type === 'location') {
                    // 📍 LOCATION MESSAGE (Premium UX)
                    console.log(`📍 Receiving Location from ${from}`);
                    try {
                        const location = message.location;
                        const session = await getSession(from);

                        // Check if we're in checkout waiting for location
                        if (session.mode === 'CHECKOUT' && session.checkoutState?.checkoutStep === 'COLLECT_LOCATION') {
                            session.checkoutState.location = {
                                latitude: location.latitude,
                                longitude: location.longitude,
                                address: location.address || location.name
                            };

                            // Advance to address collection
                            session.checkoutState.checkoutStep = 'COLLECT_ADDRESS';
                            await updateSession(from, session);

                            await sendWhatsApp(from, {
                                text: "📍 ¡Ubicación recibida!\n\nAhora, por favor escribe tu dirección completa:\n(Calle, Número, Colonia)"
                            });
                            return; // Don't process as text
                        } else {
                            // Location sent outside of checkout context
                            await sendWhatsApp(from, {
                                text: "📍 Ubicación recibida. ¿En qué puedo ayudarte?"
                            });
                            return;
                        }
                    } catch (e) {
                        console.error("Location processing error:", e);
                    }
                }
                else if (message.type === 'interactive') {
                    const interactive = message.interactive;
                    if (interactive.type === 'button_reply') {
                        const id = interactive.button_reply.id;
                        text = (id.includes('_') && !id.startsWith('btn_')) ? id : interactive.button_reply.title;
                    } else if (interactive.type === 'list_reply') {
                        text = interactive.list_reply.id;
                    } else if (interactive.type === 'nfm_reply') {
                        // Handle Flow Response specially
                        try {
                            const responseJson = JSON.parse(interactive.nfm_reply.response_json);
                            console.log("🌸 FLOW RESPONSE:", responseJson);
                            await handleFlowResponse(from, responseJson);
                            return; // Flow handled separately
                        } catch (e) {
                            console.error("Flow Parse Error:", e);
                        }
                    }
                }

                else if (['image', 'video', 'sticker', 'document', 'contacts'].includes(message.type)) {
                    // 🚫 UNSUPPORTED MEDIA HANDLING (Senior UX)
                    // Instead of silence, we educate the user.
                    console.log(`⚠️ Unsupported Message Type: ${message.type}`);
                    await sendWhatsApp(from, {
                        text: "🙈 Lo siento, mi cerebro digital aún no procesa fotos, videos ni stickers.\n\nPor favor escríbeme lo que necesitas. 📝"
                    });
                    return;
                }

                // --- PROCESS EXTRACTED TEXT ---
                if (text) {
                    // 🛡️ INPUT SANITIZATION (Security)
                    // Protect against DOS (Denial of Service) via massive payloads
                    if (text.length > 1000) {
                        console.warn(`⚠️ Truncating massive message from ${from} (${text.length} chars)`);
                        text = text.substring(0, 1000) + "... (truncado)";
                    }

                    // Remove Control Characters (Zalgo-proofing basic)
                    // eslint-disable-next-line no-control-regex
                    text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

                    await processMessage(from, text);
                }

            } catch (bgError) {
                console.error("🔥 Background Task Error:", bgError);
                // 🛡️ GLOBAL SAFETY NET
                // If we know 'from', we try to tell them we crashed.
                if (from) {
                    try {
                        await sendWhatsApp(from, { text: "🔧 Tuve un pequeño error técnico. ¿Podrías intentar escribir 'Hola' de nuevo?" });
                    } catch (e) {
                        console.error("Failed to send error notification:", e);
                    }
                }
            }
        };

        if (runtime) {
            runtime.waitUntil(processTask());
        } else {
            // Local dev fallback
            await processTask();
        }

        return new Response("EVENT_RECEIVED", { status: 200 });

    } catch (error) {
        console.error("🔥 FATAL SERVER ERROR:", error);
        // Always return 200 to stop Meta from retrying indefinitely on bad logic
        return new Response("INTERNAL_SERVER_ERROR_HANDLED", { status: 200 });
    }
});

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

