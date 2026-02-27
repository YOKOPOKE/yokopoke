// Supabase Edge Function para webhook conversacional de WhatsApp
// Deploy: npx supabase functions deploy whatsapp-webhook

// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // DEPRECATED
import { getSession, updateSession, clearSession, SessionData, BuilderState, CheckoutState } from './session.ts';
import { getProductWithSteps, getCategories, getAllProducts, getCategoryByName, getProductsByCategory, ProductTree, ProductStep } from './productService.ts';
import { analyzeIntent } from './gemini.ts';
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
    location?: {
        lat: number;
        lng: number;
        name: string;
        address: string;
    };
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
        const history = await getOrderHistory(context.from, 5);

        // #7 FIX: Skip expensive Gemini call for new users with no history
        if (history.length === 0) {
            return {
                text: "Bienvenido a *Yoko Poke* Tu asistente virtual 🍣\n\nPara una experiencia más rápida y visual, ordena directamente desde nuestra Web app:\n\n👉 *yokopoke.mx*\n\nTambién puedo ayudarte por aquí. ¿En qué te puedo servir?"
            };
        }

        const { generatePersonalizedGreeting } = await import('./gemini.ts');
        const greeting = await generatePersonalizedGreeting(context.from, history as any);

        return {
            text: greeting + "\n\n🌐 https://yokopoke.mx"
        };
    } catch (e) {
        console.error("Error generating personalized greeting:", e);
        // Fallback Greeting
        return {
            text: "Bienvenido a *Yoko Poké* 🍣\n\nPara una experiencia más rápida y visual, ordena directamente desde nuestra app:\n\n👉 *yokopoke.mx*\n\nTambién puedo ayudarte por aquí. ¿En qué te puedo servir?"
        };
    }
}

/**
 * BUILDER DESACTIVADO EN WHATSAPP — Solo funciona en la web (yokopoke.mx)
 * Se conserva el código por si se necesita en el futuro.
 * 
 * Logic for the step-by-step Poke Builder
 */
/*
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
        } catch (e) {/* ignore * / }

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


*/

/**
 * Main Logic
 */
export async function processMessage(from: string, text: string): Promise<void> {
    /* DEBOUNCE LOGIC WITH FAST PASS EXCEPTION */
    let session = await getSession(from);
    const now = Date.now();

    // --- HUMAN MODE (The "Pausa" Button) ---
    const lowerText = text.toLowerCase().trim();

    // --- EMERGENCY RESET (The "Nuclear" Option) ---
    if (lowerText === '/reset' || lowerText === '/restart' || lowerText === 'resetear') {
        console.log(`🚨 MANUAL RESET TRIGGERED for ${from}`);
        await clearSession(from);
        // Update LOCAL session immediately
        session.mode = 'NORMAL';
        session.checkoutState = undefined;
        session.builderState = undefined;
        session.isProcessing = false;

        await sendWhatsApp(from, { text: "🔄 Sesión reiniciada forzosamente. Intenta de nuevo." });
        return;
    }

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
        // Still save to history so CRM can see the message
        if (!session.conversationHistory) session.conversationHistory = [];
        session.conversationHistory.push({ role: 'user', text: text, timestamp: now });
        if (session.conversationHistory.length > 20) session.conversationHistory = session.conversationHistory.slice(-20);
        await updateSession(from, session);
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
        // Use reliable timezone method (consistent with checkout.ts)
        const bizHoursFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Mexico_City',
            hour: '2-digit', hour12: false
        });
        const bizHoursParts = bizHoursFormatter.formatToParts(new Date());
        const currentHour = parseInt(bizHoursParts.find(p => p.type === 'hour')?.value || '0');

        const isOpen = currentHour >= open && currentHour < close;

        if (!isOpen) {
            console.log(`🔒 Restaurant closed (${currentHour}:00, Open: ${open}-${close}) for ${from}`);

            // Save to history so CRM can see the message
            if (!session.conversationHistory) session.conversationHistory = [];
            session.conversationHistory.push({ role: 'user', text: text, timestamp: now });

            const openTimeStr = `${open > 12 ? open - 12 : open}:00 ${open >= 12 ? 'PM' : 'AM'}`;
            const closedMsg = `👋 ¡Hola! Estamos cerrados en este momento 🌙.\n\nPuedes *adelantar tu pedido* para las *${openTimeStr}* directamente en nuestra Web App: 👇\n\n📲 *https://yokopoke.mx*\n\n¡Es más rápido y sin esperas! 🍣✨\n\n¡Nos vemos pronto! 👋`;
            session.conversationHistory.push({ role: 'bot', text: closedMsg, timestamp: now });
            if (session.conversationHistory.length > 20) session.conversationHistory = session.conversationHistory.slice(-20);
            await updateSession(from, session);

            await sendWhatsApp(from, { text: closedMsg });
            return;
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
        // Don't return — let the message flow through the normal batching below
    }

    // --- SMART MESSAGE BATCHING ---
    // Queue the message immediately in DB
    if (!session.pendingMessages) session.pendingMessages = [];
    session.pendingMessages.push({
        text: text,
        type: 'text',
        timestamp: Date.now()
    });

    // Watchdog: Break Stale Locks (>25s)
    if (session.isProcessing && session.processingStart && (Date.now() - session.processingStart > 25000)) {
        console.warn(`🐕 Watchdog: Breaking stale lock for ${from} (>25s)`);
        session.isProcessing = false;
    }

    // If locked, just queue and exit — the active processor will pick it up
    if (session.isProcessing) {
        console.log(`🔒 Session locked for ${from}. Queued message #${session.pendingMessages.length}.`);
        await updateSession(from, session);
        return;
    }

    // Acquire Lock
    session.isProcessing = true;
    session.processingStart = Date.now();
    await updateSession(from, session);

    // ⏳ DEBOUNCE: Wait 5s for rapid-fire messages to accumulate
    await new Promise(r => setTimeout(r, 5000));

    // Re-read session to get ALL queued messages
    let workSession = await getSession(from);
    const queue = workSession.pendingMessages || [];

    // Sort by timestamp (FIFO) and deduplicate
    queue.sort((a, b) => a.timestamp - b.timestamp);
    const uniqueQueue = queue.filter((item, index, self) =>
        index === 0 || item.text !== self[index - 1].text
    );

    // Join all messages into one text
    const aggregatedText = uniqueQueue.map(q => q.text).join(". ");
    console.log(`🔥 Processing Batch (${uniqueQueue.length} msgs): "${aggregatedText}"`);

    // Clear Queue but Keep Lock
    workSession.pendingMessages = [];
    workSession.lastInteraction = Date.now();
    session = workSession;

    // Guard: If queue was empty (race condition), release lock and exit
    if (!aggregatedText || aggregatedText.trim().length === 0) {
        console.warn(`⚠️ Empty queue after debounce for ${from}. Releasing lock.`);
        session.isProcessing = false;
        await updateSession(from, session);
        return;
    }

    // --- FAST PASS: Try instant keywords on the FULL aggregated text ---
    const aggregatedLower = aggregatedText.toLowerCase();
    const instantResponse = await handleInstantKeywords(from, aggregatedLower, session);
    if (instantResponse) {
        console.log(`⚡ Fast Pass: Keyword Match for ${from}`);
        await sendWhatsApp(from, instantResponse);

        // Armar Poke is now handled entirely inside handleInstantKeywords
        if (aggregatedLower.includes('armar') && aggregatedLower.includes('poke')) {
            session.isProcessing = false;
            await updateSession(from, session);
            return;
        }

        // 🧠 Save to conversation memory
        if (!session.conversationHistory) session.conversationHistory = [];
        session.conversationHistory.push({ role: 'user', text: aggregatedText, timestamp: now });
        if (instantResponse.text) session.conversationHistory.push({ role: 'bot', text: instantResponse.text, timestamp: now });
        if (session.conversationHistory.length > 50) session.conversationHistory = session.conversationHistory.slice(-50);
        session.lastInteraction = now;
        session.isProcessing = false;
        session.activeThreadId = undefined;
        await updateSession(from, session);
        return;
    }

    // --- DETERMINISTIC ROUTER (THE "CEREBELLUM") ---
    let sessionCleared = false; // #2 FIX: Track if session was cleared to protect finally block
    try {
        // A. MODE-BASED ROUTING (Highest Priority)
        // If we are in a specific mode, we stay there until explicitly exited.

        // 1. BUILDER MODE — DESACTIVADO: El builder solo funciona en la web (yokopoke.mx)
        // Si alguien llega aquí, se redirige al menú.
        // POKE_BUILDER: User selected a size and is now sending ingredients
        if (session.mode === 'POKE_BUILDER' && session.pokeBuilder) {
            console.log(`🥗 Poke Builder: input from ${from}`);
            const ingredientsLower = aggregatedText.toLowerCase();

            // Cancel detection
            const cancelWords = ['cancelar', 'cancel', 'no', 'salir', 'menu', 'menú', 'volver', 'otro'];
            if (cancelWords.some(w => ingredientsLower === w || ingredientsLower.includes('cancelar') || ingredientsLower.includes('no quiero'))) {
                session.mode = 'NORMAL';
                session.pokeBuilder = undefined;
                session.isProcessing = false;
                await updateSession(from, session);
                await sendWhatsApp(from, {
                    text: '👌 Sin problema, pedido cancelado.\n\n¿En qué más te puedo ayudar?',
                    useButtons: true,
                    buttons: ['Ver Menú', 'Armar un Poke']
                });
                return;
            }

            const ingredients = aggregatedText;
            const size = session.pokeBuilder.size;
            const price = session.pokeBuilder.price;
            const productId = session.pokeBuilder.productId;

            // --- INGREDIENT CATEGORIZATION ---
            const BASES = ['arroz blanco', 'arroz negro', 'pasta', 'mix de vegetales', 'vegetales'];
            const PROTEINAS = ['atún', 'atun', 'spicy tuna', 'sweet salmon', 'salmon', 'salmón', 'camarones', 'camarón', 'pollo al grill', 'pollo grill', 'pollo teriyaki', 'teriyaki', 'arrachera', 'surimi'];
            const TOPPINGS = ['pepino', 'aguacate', 'mango', 'zanahoria', 'elotes', 'elote', 'pimiento', 'pimientos', 'edamames', 'edamame', 'tomate cherry', 'tomate', 'queso philadelphia', 'philadelphia', 'alga wakame', 'wakame'];
            const CRUNCH = ['cacahuate garapiñado', 'garapiñado', 'won ton', 'wonton', 'cacahuate enchilado', 'enchilado', 'betabel bacon', 'banana chips', 'almendra fileteada', 'almendra', 'cacahuate'];
            const SALSAS = ['soya', 'siracha', 'sriracha', 'ponzu', 'mango habanero', 'habanero', 'mayo ajo', 'mayo cilantro', 'anguila', 'agridulce', 'mayo chipotle', 'chipotle', 'olive oil', 'aceite oliva', 'habanero drops', 'betabel spicy', 'cacahuate'];

            // Size requirements
            const reqs: Record<string, { base: number; prote: number; topping: number; crunch: number; salsa: number }> = {
                'Chico': { base: 1, prote: 1, topping: 2, crunch: 1, salsa: 1 },
                'Mediano': { base: 1, prote: 2, topping: 3, crunch: 2, salsa: 2 },
                'Grande': { base: 2, prote: 3, topping: 4, crunch: 2, salsa: 2 }
            };
            const req = reqs[size] || reqs['Mediano'];

            // Count what the user selected
            const found = { base: 0, prote: 0, topping: 0, crunch: 0, salsa: 0 };
            for (const b of BASES) { if (ingredientsLower.includes(b)) found.base++; }
            for (const p of PROTEINAS) { if (ingredientsLower.includes(p)) found.prote++; }
            for (const t of TOPPINGS) { if (ingredientsLower.includes(t)) found.topping++; }
            for (const c of CRUNCH) { if (ingredientsLower.includes(c)) found.crunch++; }
            for (const s of SALSAS) { if (ingredientsLower.includes(s)) found.salsa++; }

            // Check for missing categories
            const missing: string[] = [];
            if (found.base < 1) missing.push(`🍚 *Base* (ej: Arroz blanco, Arroz negro, Pasta)`);
            if (found.prote < 1) missing.push(`🥩 *Proteína* (ej: Atún, Salmon, Camarones, Pollo)`);
            if (found.topping < 1) missing.push(`🥑 *Toppings* (ej: Aguacate, Mango, Pepino, Edamames)`);
            if (found.crunch < 1) missing.push(`🥜 *Crunch* (ej: Won Ton, Cacahuate, Almendra)`);
            if (found.salsa < 1) missing.push(`🫗 *Salsa* (ej: Ponzu, Mayo cilantro, Siracha)`);

            if (missing.length > 0) {
                // Tell user what's missing — stay in POKE_BUILDER mode
                await updateSession(from, session);
                await sendWhatsApp(from, {
                    text: `⚠️ Te falta elegir:\n\n${missing.join("\n")}\n\nMándame todo junto para completar tu *Poke ${size}* 🥗`
                });
                return;
            }

            // All good — add to cart
            if (!session.checkoutState) session.checkoutState = {};
            if (!session.checkoutState.cart) session.checkoutState.cart = [];

            session.checkoutState.cart.push({
                id: productId,
                name: `POKE ${size.toUpperCase()}`,
                price: price,
                quantity: 1,
                customizations: ingredients
            });

            session.mode = 'NORMAL';
            session.pokeBuilder = undefined;
            session.isProcessing = false;
            session.activeThreadId = undefined;
            await updateSession(from, session);

            const cartTotal = session.checkoutState.cart.reduce((s: number, i: any) => s + (i.price * i.quantity), 0);
            await sendWhatsApp(from, {
                text: `✅ *Poke ${size} agregado a tu carrito*\n\n📝 *Ingredientes:* ${ingredients}\n💰 *Precio:* $${price}\n\n🛒 *Total del carrito: $${cartTotal}*\n\n¿Deseas algo más o deseas finalizar tu pedido?`,
                useButtons: true,
                buttons: ['Pagar 💳', 'Ver Menú', 'Agregar otro Poke']
            });
            return;
        }

        if (session.mode === 'BUILDER' && session.builderState) {
            session.mode = 'NORMAL';
            session.builderState = undefined;
            session.isProcessing = false;
            sessionCleared = true;
        }

        // 2. UPSELL MODE (Postres by Geranio)
        // PRE-CHECK: Detect if user wants to escape upsell before entering mode handler
        if (session.mode === 'UPSELL_DESSERT' && session.upsellProduct) {
            const lower = aggregatedText.toLowerCase();
            const escapeKeywords = ['ver', 'menu', 'menú', 'quiero', 'dame', 'enseña', 'muestra', 'entradas', 'pokes', 'bebidas', 'postres', 'carta', 'pedido', 'otro', 'armar', 'hola', 'ayuda'];
            const isEscaping = escapeKeywords.some(k => lower.includes(k)) || lower.split(' ').length > 5;
            const positives = ['si', 'sí', 'claro', 'va', 'dale', 'agrega', 'agregar', 'ponlo', 'ok', 'bueno', session.upsellProduct.name.toLowerCase()];
            const negatives = ['no', 'gracias', 'nel', 'finalizar', 'ya no', 'cerrar', 'listo', 'pagar', 'checkout', 'pago'];

            if (positives.some(k => lower.includes(k))) {
                // Add to cart
                if (!session.cart) session.cart = [];
                session.cart.push({
                    id: session.upsellProduct.id,
                    name: session.upsellProduct.name,
                    price: session.upsellProduct.price,
                    quantity: 1
                });
                const subtotal = session.cart.reduce((s: number, i: any) => s + (i.price * (i.quantity || 1)), 0);
                await sendWhatsApp(from, { text: `✅ ¡Agregado! 🍰\n\nTu total actual: $${subtotal}` });

                session.mode = 'CHECKOUT';
                session.checkoutState = {
                    productSlug: 'custom-order',
                    selections: {},
                    totalPrice: subtotal,
                    checkoutStep: 'COLLECT_NAME',
                };
                delete session.upsellProduct;
                await updateSession(from, session);

                await sendWhatsApp(from, { text: `Para finalizar, ¿a qué nombre registro tu pedido? 📝` });
                return;
            }

            else if (negatives.some(k => lower.includes(k))) {
                const subtotal = session.cart ? session.cart.reduce((s: number, i: any) => s + (i.price * (i.quantity || 1)), 0) : 0;
                session.mode = 'CHECKOUT';
                session.checkoutState = {
                    productSlug: 'custom-order',
                    selections: {},
                    totalPrice: subtotal,
                    checkoutStep: 'COLLECT_NAME',
                };
                delete session.upsellProduct;
                await updateSession(from, session);

                await sendWhatsApp(from, { text: `Entendido. Total: $${subtotal}. 📝 ¿A qué nombre registro tu pedido?` });
                return;
            }

            else if (isEscaping) {
                // User wants to do something else — exit upsell, fall through to NORMAL processing
                console.log(`🚪 User escaping upsell mode: "${aggregatedText}"`);
                session.mode = 'NORMAL';
                delete session.upsellProduct;
                // DON'T return — will fall through to the NORMAL else block below
            }

            else {
                // Ambiguous short response — ask once more
                await sendWhatsApp(from, {
                    text: "¿Te animas con el postre? 🍰\nResponde 'Sí' para agregarlo o 'No' para continuar.",
                    useButtons: true,
                    buttons: ['Sí, agregar', 'No, finalizar']
                });
                return;
            }
        }

        // 3. CHECKOUT MODE
        if (session.mode === 'CHECKOUT' && session.checkoutState) {
            console.log(`💳 Processing Checkout Flow for ${from}`);

            // Check for Exit Keywords (broad Spanish cancel detection)
            const cancelKeywords = ['cancela', 'cancelar', 'cancelalo', 'no quiero', 'ya no', 'olvídalo', 'olvidalo', 'salir', 'dejalo', 'déjalo', 'no gracias'];
            const checkoutLower = aggregatedText.toLowerCase();
            if (cancelKeywords.some(k => checkoutLower.includes(k))) {
                await clearSession(from);
                // #5 FIX: Update local session + flag to prevent finally block from overwriting
                session.mode = 'NORMAL';
                session.checkoutState = undefined;
                session.builderState = undefined;
                session.isProcessing = false;
                sessionCleared = true;
                await sendWhatsApp(from, { text: "Entendido, no te preocupes. 👌\n\nHe cancelado la orden actual. Cuando quieras, aquí estaré listo para tomar tu pedido de nuevo. 🐼✨\n\n¿Te gustaría ver el menú?" });
                return;
            }

            const { handleCheckoutFlow } = await import('./checkout.ts');
            const response = await handleCheckoutFlow(from, aggregatedText, session, sendButtonMessage, sendWhatsAppText);

            // Clear session if checkout completed or cancelled
            if (response.text && (response.text.includes('ORDEN CONFIRMADA') || response.text.includes('cancelada'))) {
                await clearSession(from);
                // #2 FIX: Update LOCAL session + flag to prevent finally block from overwriting
                session.mode = 'NORMAL';
                session.checkoutState = undefined;
                session.builderState = undefined;
                session.isProcessing = false;
                sessionCleared = true;
            } else {
                await updateSession(from, session);
            }

            // Only send if checkout didn't already send the message directly
            if (response.text) {
                await sendWhatsApp(from, response);
                // 📨 Log to Telegram CRM
                try {
                    const { logConversationToTelegram } = await import('./telegramService.ts');
                    const custName = session.checkoutState?.customerName || undefined;
                    await logConversationToTelegram(from, custName, aggregatedText, response.text);
                } catch (_) { /* non-critical */ }
            }
            // Save conversation history for checkout
            if (!sessionCleared) {
                if (!session.conversationHistory) session.conversationHistory = [];
                session.conversationHistory.push({ role: 'user', text: aggregatedText, timestamp: now });
                if (response.text) session.conversationHistory.push({ role: 'bot', text: response.text, timestamp: now });
                if (session.conversationHistory.length > 50) session.conversationHistory = session.conversationHistory.slice(-50);
            }
        }

        // B. GENERAL AI / KEYWORD LOGIC (Normal Mode)
        else if (session.mode === 'NORMAL' || !session.mode) {
            // ... (Fallthrough to existing AI logic below) ...

            // --- IGNORE INTERNAL BUTTON IDS ---
            // If text starts with 'btn_', it's an unhandled button click from a flow we might not have caught.
            // Or it might be a race condition. AI shouldn't try to answer "btn_0".
            if (aggregatedText.startsWith('btn_')) {
                console.log(`🤖 Ignoring internal button ID: ${aggregatedText}`);
                // Release lock before exiting
                session.isProcessing = false;
                session.activeThreadId = undefined;
                await updateSession(from, session);
                return;
            }

            const prodService = await import('./productService.ts');
            const categories = await prodService.getCategories();

            // --- CATEGORY SELECTION HANDLER (cat_ID) + armar_poke ---
            if (text === 'armar_poke') {
                session.isProcessing = false;
                session.activeThreadId = undefined;
                await updateSession(from, session);
                // Send size selection list
                await sendListMessage(from, {
                    header: '🥗 Arma tu Poke',
                    body: 'Elige el tamaño de tu Poke Bowl. Cada tamaño incluye diferentes cantidades de ingredientes.',
                    buttonText: 'Ver Tamaños',
                    sections: [{
                        title: 'Tamaños',
                        rows: [
                            { id: 'poke_chico', title: '🥗 Chico — $140', description: '1 base, 1 prote, 2 toppings, 1 crunch, 1 salsa' },
                            { id: 'poke_mediano', title: '🥗 Mediano — $165', description: '1 base, 2 protes, 3 toppings, 2 crunch, 2 salsas' },
                            { id: 'poke_grande', title: '🥗 Grande — $190', description: '2 bases, 3 protes, 4 toppings, 2 crunch, 2 salsas' }
                        ]
                    }]
                });
                return;
            }

            // --- POKE SIZE SELECTION HANDLER ---
            if (text === 'poke_chico' || text === 'poke_mediano' || text === 'poke_grande') {
                const sizeMap: Record<string, { size: string; price: number; productId: number }> = {
                    poke_chico: { size: 'Chico', price: 140, productId: 47 },
                    poke_mediano: { size: 'Mediano', price: 165, productId: 44 },
                    poke_grande: { size: 'Grande', price: 190, productId: 39 }
                };
                const selected = sizeMap[text];

                // Set POKE_BUILDER mode
                session.mode = 'POKE_BUILDER';
                session.pokeBuilder = { size: selected.size, price: selected.price, productId: selected.productId };
                session.isProcessing = false;
                session.activeThreadId = undefined;
                await updateSession(from, session);

                // Send the menu image
                await sendWhatsAppImage(from, 'https://yokopoke.mx/arma-tu-poke.jpg', `Poke ${selected.size} — $${selected.price}`);

                // Follow-up message with size-specific quantities
                const sizeInfo: Record<string, string> = {
                    'Chico': '1 base, 1 proteína, 2 toppings, 1 crunch y 1 salsa',
                    'Mediano': '1 base, 2 proteínas, 3 toppings, 2 crunch y 2 salsas',
                    'Grande': '2 bases, 3 proteínas, 4 toppings, 2 crunch y 2 salsas'
                };
                await sendWhatsApp(from, {
                    text: `✅ *Poke ${selected.size}* seleccionado\n\nTu tamaño incluye: *${sizeInfo[selected.size]}*\n\nRevisa la imagen y envíame tus ingredientes en un solo mensaje 👇\n\n_Ejemplo: Arroz blanco, atún fresco, aguacate, mango, won ton, ponzu_`
                });
                return;
            }

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
                        // Save conversation history
                        if (!session.conversationHistory) session.conversationHistory = [];
                        session.conversationHistory.push({ role: 'user', text: aggregatedText, timestamp: now });
                        if (session.conversationHistory.length > 50) session.conversationHistory = session.conversationHistory.slice(-50);
                        // Release lock
                        session.isProcessing = false;
                        session.activeThreadId = undefined;
                        await updateSession(from, session);
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
                        // Release lock
                        session.isProcessing = false;
                        session.activeThreadId = undefined;
                        await updateSession(from, session);
                        return;
                    }
                }
            }

            const menuContext = await prodService.getMenuContext();
            const allProducts = await prodService.getAllProducts();

            // 👤 LOAD CUSTOMER DNA (favorites + profile)
            let customerProfile: { favorites?: string[], orderCount?: number } | undefined;
            try {
                const { getOrderHistory, getFavoriteItems } = await import('./orderHistoryService.ts');
                const [favorites, history] = await Promise.all([
                    getFavoriteItems(from),
                    getOrderHistory(from, 1)
                ]);
                if (favorites.length > 0 || history.length > 0) {
                    customerProfile = {
                        favorites,
                        orderCount: history.length
                    };
                    // Cache in session for checkout pre-fill
                    if (!session.customerProfile) {
                        session.customerProfile = {
                            favorites,
                            orderCount: history.length,
                            name: history[0]?.customer_name,
                            lastAddress: history[0]?.full_address,
                            lastAddressRefs: history[0]?.address_references
                        };
                    }
                }
            } catch (e) {
                console.error('Customer DNA load error:', e);
            }

            // 🧠 Prepare conversation history for Gemini
            const chatHistory = (session.conversationHistory || []).map(m => ({ role: m.role, text: m.text }));

            // ANALYZE INTENT with CART Context
            let geminiResponse: any;
            try {
                geminiResponse = await import('./gemini.ts').then(m => m.analyzeIntent(aggregatedText, chatHistory.map(h => `${h.role}: ${h.text}`), session.cart || []));
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
                        // Save conversation history
                        if (!session.conversationHistory) session.conversationHistory = [];
                        session.conversationHistory.push({ role: 'user', text: aggregatedText, timestamp: now });
                        if (session.conversationHistory.length > 50) session.conversationHistory = session.conversationHistory.slice(-50);
                        // Release lock
                        session.isProcessing = false;
                        session.activeThreadId = undefined;
                        await updateSession(from, session);
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
                // Save conversation history
                if (!session.conversationHistory) session.conversationHistory = [];
                session.conversationHistory.push({ role: 'user', text: aggregatedText, timestamp: now });
                if (session.conversationHistory.length > 50) session.conversationHistory = session.conversationHistory.slice(-50);
                // Release lock
                session.isProcessing = false;
                session.activeThreadId = undefined;
                await updateSession(from, session);
                return; // STOP HERE.
            }

            // Legacy fallthrough REMOVED. relying on analyzeIntent (CATEGORY_FILTER or CHAT)
            // to handle "menu" requests appropriately without hijacking ADD_TO_CART flows.

            else if (geminiResponse.intent === 'CHECKOUT') {
                // --- CHECKOUT INIT ---
                console.log("💳 Intent is CHECKOUT -> Starting Checkout Flow");

                // 🛡️ GUARD: Prevent checkout with empty cart
                if (!session.cart || session.cart.length === 0) {
                    await sendWhatsApp(from, {
                        text: "🛒 Tu carrito está vacío. Agrega algo primero antes de finalizar. ¿Qué se te antoja?",
                        useButtons: true,
                        buttons: ['Ver Menú', 'Pokes de la Casa']
                    });
                    // Note: lock released in common cleanup below
                } else {
                    // --- UPSELL LOGIC (Postres by Geranio) ---
                    // Check if cart has desserts
                    const hasDessert = session.cart.some((item: any) => {
                        const product = allProducts.find(p => p.id === item.id || p.slug === item.id);
                        // Check category or name
                        if (item.name.toLowerCase().includes('postre') || item.name.toLowerCase().includes('cake') || item.name.toLowerCase().includes('pay')) return true;
                        // Use category_id safely
                        if (product && product.category_id) {
                            const cat = categories.find(c => c.id === product.category_id);
                            if (cat && (cat.slug === 'postres' || cat.name.toLowerCase().includes('postre'))) return true;
                        }
                        return false;
                    });

                    // Find Dessert Candidate to Upsell
                    let upsellCandidate = null;
                    if (!hasDessert) {
                        const postreCat = categories.find(c => c.slug === 'postres' || c.name.toLowerCase().includes('postre'));
                        if (postreCat) {
                            const postres = allProducts.filter(p => p.category_id === postreCat.id);
                            if (postres.length > 0) {
                                // PRIORITY: "Geranio"
                                const geranioItem = postres.find(p => p.name.toLowerCase().includes('geranio'));
                                upsellCandidate = geranioItem || postres[0];
                            }
                        }
                    }

                    if (upsellCandidate) {
                        console.log(`🍰 Triggering Upsell: ${upsellCandidate.name}`);
                        session.mode = 'UPSELL_DESSERT';
                        session.upsellProduct = {
                            id: String(upsellCandidate.id),
                            name: upsellCandidate.name,
                            price: upsellCandidate.base_price
                        };
                        await updateSession(from, session);

                        // Send Upsell Message (Image + Buttons)
                        const msgText = `🍰 *¡Un momento!* Antes de cerrar...\n\n¿No se te antoja un *${upsellCandidate.name}* (by Geranio)? 🤤\n\nEs el complemento perfecto. ¿Lo agregamos?`;

                        if (upsellCandidate.image_url) {
                            await sendWhatsAppImage(from, upsellCandidate.image_url, msgText);
                        } else {
                            await sendWhatsApp(from, { text: msgText });
                        }

                        // Buttons (separate message often better for button stability/compatibility with image caption limits)
                        await sendWhatsApp(from, {
                            text: "¿Lo agregamos?", // Redundant text required for button message
                            useButtons: true,
                            buttons: [`Sí, agregar (${upsellCandidate.name})`, 'No, finalizar pedido']
                        });

                        // STOP here, wait for user response
                        if (session.isProcessing) {
                            session.isProcessing = false;
                            await updateSession(from, session);
                        }
                        return;
                    }

                    // --- END UPSELL ---

                    // Initialize Checkout from Cart (Normal Flow)
                    const initialTotal = session.cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

                    session.mode = 'CHECKOUT';
                    session.checkoutState = {
                        productSlug: 'custom-order',
                        selections: {},
                        totalPrice: initialTotal,
                        checkoutStep: 'COLLECT_NAME',
                    };
                    await updateSession(from, session);

                    const response = {
                        text: `¡Excelente! El total es $${initialTotal}. Para tomar tu pedido, ¿a qué nombre lo registro? 📝`
                    };
                    await sendWhatsApp(from, response);
                }
                // Note: lock released in the common cleanup below, don't return early
            } else if (geminiResponse.intent === 'START_BUILDER') {
                // Builder desactivado en WhatsApp → Enviar Link Texto (WebView friendly)
                await sendWhatsApp(from, {
                    text: "🥗 *¡Armar tu Poke es toda una experiencia!* ✨\n\nElige cada ingrediente a tu gusto y ve fotos de todo en nuestro *Constructor Interactivo*.\n\n👇 *Entra aquí:*\nhttps://yokopoke.mx/?phone=" + from + "&source=whatsapp#product-selector",
                    useButtons: true,
                    buttons: ['Ver Menú', 'Pokes de la Casa']
                });
            } else {
                // GENERAL CHAT / SALES
                let salesRes;
                try {
                    salesRes = await import('./gemini.ts').then(m => m.generateSalesResponse(
                        aggregatedText, menuContext, allProducts, session.cart || [],
                        chatHistory, customerProfile
                    ));
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
                if (salesRes.server_action && salesRes.server_action.type === 'ADD_TO_CART') {
                    const products = salesRes.server_action.products ||
                        ((salesRes.server_action as any).product ? [(salesRes.server_action as any).product] : []);

                    console.log(`🛒 Executing ADD_TO_CART for ${products.length} product(s)`);
                    if (!session.cart) session.cart = [];

                    for (const requested of products) {
                        const requestedId = requested.id;
                        const requestedName = requested.name;

                        // REALITY CHECK: Does this product actually exist?
                        let realProduct = allProducts.find(p => String(p.id) === String(requestedId) || p.slug === requestedId);

                        // If not found by ID/Slug, fuzzy search by Name
                        if (!realProduct && requestedName) {
                            realProduct = allProducts.find(p => p.name.toLowerCase().includes(requestedName.toLowerCase()));
                        }

                        if (realProduct) {
                            // Consolidate: if same product exists, increase quantity
                            const existingItem = session.cart.find((c: any) => String(c.id) === String(realProduct!.id) || c.name === realProduct!.name);
                            if (existingItem) {
                                existingItem.quantity = (existingItem.quantity || 1) + (requested.quantity || 1);
                                console.log(`✅ Updated Cart: ${realProduct.name} → qty ${existingItem.quantity}`);
                            } else {
                                session.cart.push({
                                    id: String(realProduct.id || realProduct.slug),
                                    name: realProduct.name,
                                    price: realProduct.base_price,
                                    quantity: requested.quantity || 1
                                });
                                console.log(`✅ Added to Cart: ${realProduct.name} ($${realProduct.base_price})`);
                            }
                        } else {
                            console.warn(`🛑 BLOCKED Hallucinated Product: ${requestedName} (ID: ${requestedId})`);
                        }
                    }
                    // Build premium cart summary
                    if (session.cart.length > 0) {
                        salesRes.text += `\n\n` + formatCartDisplay(session.cart);
                    }
                    // Save immediately
                    await updateSession(from, session);
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

                    const success = await sendListMessage(from, {
                        header: "Menú Yoko Poke",
                        body: salesRes.text || "Selecciona una opción del menú:",
                        footer: "Toca el botón para ver más 👇",
                        buttonText: "Ver Opciones",
                        sections: [
                            {
                                title: (salesRes.listData.title || "Productos").substring(0, 24),
                                rows: rows
                            }
                        ]
                    });

                    if (!success) {
                        // Fallback to TEXT/BUTTONS if List fails
                        console.warn("⚠️ List Message Failed. Fallback to Standard Response.");
                        const response = {
                            text: salesRes.text,
                            useButtons: salesRes.suggested_actions && salesRes.suggested_actions.length > 0,
                            buttons: salesRes.suggested_actions?.slice(0, 2)
                        };
                        if (salesRes.show_image_url) await sendWhatsAppImage(from, salesRes.show_image_url, "");
                        await sendWhatsApp(from, response);
                    }
                    // Stop here
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

        // 🧠 Save conversation to memory (after all responses sent)
        if (!session.conversationHistory) session.conversationHistory = [];
        session.conversationHistory.push({ role: 'user', text: aggregatedText, timestamp: now });
        // Keep only last 5 exchanges (10 messages)
        if (session.conversationHistory.length > 50) session.conversationHistory = session.conversationHistory.slice(-50);
        session.lastInteraction = now;

        // 📨 Log AI/sales response to Telegram CRM
        try {
            // Get the last bot response that was just added to history
            const histLen = session.conversationHistory.length;
            const lastBotEntry = histLen >= 2 ? session.conversationHistory[histLen - 1] : null;
            const botText = (lastBotEntry?.role === 'bot') ? lastBotEntry.text : '';
            if (botText) {
                const { logConversationToTelegram } = await import('./telegramService.ts');
                const custName = session.checkoutState?.customerName || undefined;
                await logConversationToTelegram(from, custName, aggregatedText, botText);
            }
        } catch (_) { /* non-critical */ }

        // RELEASE LOCK
        session.isProcessing = false;
        session.activeThreadId = undefined;
        await updateSession(from, session);

    } catch (error) {
        console.error("🔥 FATAL BOT ERROR:", error);
        await sendWhatsApp(from, { text: "😰 Ups, tuve un pequeño mareo. ¿Me lo repites por favor?" });
    } finally {
        // RELEASE LOCK ALWAYS — but NOT if session was already cleared
        if (session.isProcessing && !sessionCleared) {
            session.isProcessing = false;
            session.activeThreadId = undefined;
            await updateSession(from, session);
        }
    }
}

/**
 * FAST PASS HELPER
 */
async function handleInstantKeywords(from: string, text: string, session: any): Promise<BotResponse | null> {
    const lowerText = text.toLowerCase();

    // ⚡ PRIORITY 1: FLOW TRIGGER (Armar Poke) - Send Size List
    if (lowerText.includes('armar clásico') || lowerText.includes('armar clasico') || (lowerText.includes('armar') && lowerText.includes('poke'))) {
        console.log("🥗 Triggering Poke Builder Size Selection");

        await sendListMessage(from, {
            header: '🥗 Arma tu Poke',
            body: 'Elige el tamaño de tu Poke Bowl. Cada tamaño incluye diferentes cantidades de ingredientes.',
            buttonText: 'Ver Tamaños',
            sections: [{
                title: 'Tamaños',
                rows: [
                    { id: 'poke_chico', title: '🥗 Chico — $140', description: '1 base, 1 prote, 2 toppings, 1 crunch, 1 salsa' },
                    { id: 'poke_mediano', title: '🥗 Mediano — $165', description: '1 base, 2 protes, 3 toppings, 2 crunch, 2 salsas' },
                    { id: 'poke_grande', title: '🥗 Grande — $190', description: '2 bases, 3 protes, 4 toppings, 2 crunch, 2 salsas' }
                ]
            }]
        });
        return { text: "" }; // Handled
    }

    // 0. If in Builder Mode OR Checkout (and NOT resetting), DISABLE other Fast Pass triggers
    if (session && (session.mode === 'BUILDER' || session.mode === 'CHECKOUT')) return null;

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

    // 2. (REMOVED — duplicate of Priority 1 handler above, l.1232)
    // "armar clásico" is already caught by the first check and redirects to web.

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

            if (success) return { text: "" }; // HANDLED: Stop further processing

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
        // REDIRECT TO WEB via Text Link
        await sendWhatsApp(from, {
            text: "🥗 *¡Excelente elección!* ✨\n\nPersonaliza tu Poke justo como te gusta en nuestro *Constructor Interactivo*. ¡Elige cada ingrediente!\n\n👇 *Personalizar aquí:*\nhttps://yokopoke.mx/?phone=" + from + "&source=whatsapp#product-selector",
            useButtons: true,
            buttons: ['Ver Menú de la Casa']
        });
        return { text: "" }; // Handled via CTA
    }

    // 5. Greetings + Colloquial
    // BUT ONLY if the message is PURELY a greeting — if it also contains order intent, let Gemini handle it
    const colloquial = ['bro', 'hermano', 'papi', 'bb', 'nn', 'buenas', 'que tal', 'qué tal', 'onda', 'menu', 'menú'];
    const isGreeting = (
        INTENTS.greeting.some(k => text.includes(k)) ||
        colloquial.some(k => text.includes(k)) ||
        text.includes('hola')
    );

    // Order intent signals — if ANY of these are present, the user wants something specific
    const orderSignals = ['quiero', 'dame', 'pido', 'agrega', 'agregar', 'ponme', 'manda', 'tráeme', 'traeme', 'gyoza', 'poke', 'burger', 'coca', 'agua', 'postre', 'bebida', 'spicy', 'entrada', 'calpico', 'limonada'];
    const hasOrderIntent = orderSignals.some(k => lowerText.includes(k));

    if (isGreeting && !hasOrderIntent) {
        const response = await handleBasicIntent({ from, text, timestamp: 0 });
        if (response) return response;
        return null;
    }
    // If isGreeting AND hasOrderIntent → fall through to AI (Gemini handles greeting + order together)

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

            if (success) return { text: "" }; // HANDLED: Stop further processing

            // Fallback
            const list = products.slice(0, 3).map(p => `🍔 ${p.name} - $${p.base_price}`).join('\n');
            return {
                text: `*Sushi Burgers:*\n\n${list}\n\nSelecciona una:`,
                useButtons: true,
                buttons: products.slice(0, 3).map(p => p.name)
            };
        }
    }

    // 6.4 CANCEL / CLEAR CART
    const cancelCartTriggers = ['cancela', 'cancelar', 'vaciar', 'borrar', 'limpiar', 'quitar todo', 'eliminar'];
    const cartWords = ['carrito', 'carroto', 'pedido', 'orden', 'todo'];
    const isCancelCart = cancelCartTriggers.some(t => lowerText.includes(t)) && cartWords.some(c => lowerText.includes(c));
    if (isCancelCart) {
        if (session.cart && session.cart.length > 0) {
            const itemCount = session.cart.length;
            session.cart = [];
            session.mode = 'NORMAL';
            session.checkoutState = undefined;
            delete session.upsellProduct;
            await updateSession(from, session);
            return {
                text: `🗑️ ¡Listo! Tu carrito ha sido vaciado (${itemCount} producto${itemCount > 1 ? 's' : ''} eliminado${itemCount > 1 ? 's' : ''}).\n\n¿Quieres empezar de nuevo? 🐼`,
                useButtons: true,
                buttons: ['Ver Menú', '¿Qué me recomiendas?']
            };
        } else {
            return {
                text: "Tu carrito ya está vacío 🛒\n\n¿Qué se te antoja? 😋",
                useButtons: true,
                buttons: ['Ver Menú', 'Pokes de la Casa']
            };
        }
    }

    // 6.5 Farewell / Thanks (natural closure)
    const farewells = ['adiós', 'adios', 'bye', 'chao', 'nos vemos', 'hasta luego'];
    const thanks = ['gracias', 'grax', 'thx', 'thanks'];
    const isFarewell = farewells.some(f => lowerText.includes(f));
    const isThanks = thanks.some(t => lowerText.includes(t));
    // Only match if it's NOT also an order ("gracias, y dame unas gyozas" → let Gemini handle it)
    const orderSignalsForFarewell = ['quiero', 'dame', 'agrega', 'ponme', 'pido', 'manda', 'poke', 'menú', 'menu'];
    const hasOrderSignal = orderSignalsForFarewell.some(s => lowerText.includes(s));
    if ((isFarewell || isThanks) && !hasOrderSignal) {
        const msg = isFarewell
            ? "¡Gracias por elegir Yoko Poke! 🥢✨ ¡Te esperamos pronto! 🐼"
            : "¡Con gusto! 😊 Si necesitas algo más, aquí estoy. 🐼✨";
        return {
            text: msg,
            useButtons: true,
            buttons: ['Ver Menú']
        };
    }

    // 7. 🔄 SMART RE-ORDER ("Lo de siempre")
    const reorderTriggers = ['lo de siempre', 'lo mismo', 'repetir', 'mismo pedido', 'otra vez', 'lo de ayer', 'lo que siempre pido', 'mi pedido'];
    if (reorderTriggers.some(t => lowerText.includes(t))) {
        try {
            const { getOrderHistory } = await import('./orderHistoryService.ts');
            const history = await getOrderHistory(from, 1);

            if (history.length === 0) {
                return {
                    text: "🤔 Aún no tengo pedidos guardados tuyos.\n\n¡Pero hagamos el primero! ¿Qué se te antoja hoy? 🥢",
                    useButtons: true,
                    buttons: ['Ver Menú']
                };
            }

            const lastOrder = history[0];
            const items = lastOrder.items || [];

            if (items.length === 0) {
                return {
                    text: "🤔 Encontré tu historial pero sin detalles del pedido. ¿Qué te preparo hoy?",
                    useButtons: true,
                    buttons: ['Ver Menú']
                };
            }

            // Build cart from history
            const cartItems = items.map((item: any) => ({
                id: item.id || item.name,
                name: item.name,
                price: item.price || 0,
                quantity: item.quantity || 1
            }));

            const total = cartItems.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);

            // Load cart into session
            session.cart = cartItems;
            session.lastInteraction = Date.now();
            await updateSession(from, session);

            // Build summary
            const itemList = cartItems.map((i: any) => `• ${i.quantity}x ${i.name} ($${i.price})`).join('\n');

            return {
                text: `🔄 *¡Lo de siempre!* 🎉\n\nTengo tu último pedido:\n\n${itemList}\n\n💰 *Total: $${total}*\n\n¿Lo confirmo igual o quieres cambiar algo?`,
                useButtons: true,
                buttons: ['Finalizar pedido', 'Ver Menú']
            };
        } catch (e) {
            console.error("Re-order error:", e);
            return {
                text: "😅 Tuve un problema buscando tu historial. ¿Me dices qué quieres pedir?",
                useButtons: true,
                buttons: ['Ver Menú']
            };
        }
    }

    return null;
}

// --- FLOW HELPER (DISABLED — cuenta no verificada, WhatsApp Flows no disponible) ---
// async function sendFlowMessage(to, flowId, screen, cta) { ... }


// --- DISABLED: startBuilder (Builder is web-only, this code is dead) ---
// If someone calls this accidentally, it would set session.mode='BUILDER' which is a broken state.
// async function startBuilder(from: string, slug: string) { ... }
// See handleInstantKeywords for the web redirect that replaces this.

// --- CART FORMATTING HELPER ---
function formatCartDisplay(cart: any[]): string {
    if (!cart || cart.length === 0) return "🛒 Tu carrito está vacío.";

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const lines = cart.map(item => {
        const name = item.name.toLowerCase();
        let emoji = "📦";
        if (name.includes("poke")) emoji = "🥗";
        else if (name.includes("gyoza")) emoji = "🥟";
        else if (name.includes("papa")) emoji = "🍟";
        else if (name.includes("kushiague")) emoji = "🍢"; // Use🍡 or 🍢 for kushiage
        else if (name.includes("edamame")) emoji = "🌿";
        else if (name.includes("coca") || name.includes("agua") || name.includes("calpico") || name.includes("bebida") || name.includes("tea") || name.includes("limonada") || name.includes("cerveza") || name.includes("beer")) emoji = "🥤";
        else if (name.includes("brownie") || name.includes("postre") || name.includes("cake") || name.includes("geranio")) emoji = "🍰";

        return `${emoji} *${item.quantity}x ${item.name}* — $${item.price * item.quantity}`;
    });

    return `*🛍️ Tu carrito:*\n${lines.join('\n')}\n\n💰 *Total: $${total}*`;
}

export async function sendWhatsApp(to: string, response: BotResponse) {
    // Guard: Skip entirely if no content to send
    if (!response.text && !response.useList && !response.location) return;

    // Support list messages natively
    if (response.useList && response.listData) {
        const success = await sendListMessage(to, response.listData);
        if (success) {
            // Log list message to CRM history
            await logBotMessageToHistory(to, response.listData.body || '[Lista enviada]');
            return;
        }
        // Fallback to text if list fails
    }
    if (response.location) {
        await sendWhatsAppLocation(to, response.location.lat, response.location.lng, response.location.name, response.location.address);
    }
    if (!response.text) return; // Nothing left to send
    if (response.useButtons && response.buttons && response.buttons.length > 0) {
        await sendWhatsAppButtons(to, response.text, response.buttons);
    } else {
        await sendWhatsAppText(to, response.text);
    }
    // Logging is now handled by each low-level send function
}

// Automatically save bot messages to session history so CRM sees everything
async function logBotMessageToHistory(phone: string, text: string) {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data } = await supabase
            .from('whatsapp_sessions')
            .select('state')
            .eq('phone', phone)
            .single();

        if (data?.state) {
            const state = data.state;
            if (!state.conversationHistory) state.conversationHistory = [];

            // Avoid duplicate: check if last message is the same bot text
            const last = state.conversationHistory[state.conversationHistory.length - 1];
            if (last?.role === 'bot' && last?.text === text) return;

            state.conversationHistory.push({ role: 'bot', text, timestamp: Date.now() });
            if (state.conversationHistory.length > 50) {
                state.conversationHistory = state.conversationHistory.slice(-50);
            }

            await supabase
                .from('whatsapp_sessions')
                .update({ state, updated_at: new Date().toISOString() })
                .eq('phone', phone);
        }
    } catch (e) {
        // Never let logging break the main flow
        console.error('CRM log error:', e);
    }
}

async function sendWhatsAppLocation(to: string, lat: number, lng: number, name: string, address: string) {
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
                    type: "location",
                    location: {
                        latitude: lat,
                        longitude: lng,
                        name: name,
                        address: address
                    }
                }),
            }
        );
    } catch (e) {
        console.error("Failed to send location message:", e);
    }
}

// --- CTA URL BUTTON (Professional link button, no cuenta verificada needed) ---
async function sendCtaUrlButton(to: string, bodyText: string, displayText: string, url: string) {
    const payload = {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
            type: "cta_url",
            body: { text: bodyText },
            action: {
                name: "cta_url",
                parameters: {
                    display_text: displayText,
                    url: url
                }
            }
        }
    };

    try {
        const res = await fetchWithRetry(
            `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            console.error("CTA URL Button Error:", errText);
            // Fallback to plain text with link
            await sendWhatsAppText(to, `${bodyText}\n\n👉 ${url}`);
        } else {
            console.log(`✅ CTA URL Button sent to ${to}`);
        }
    } catch (e) {
        console.error("CTA URL Button Error:", e);
        await sendWhatsAppText(to, `${bodyText}\n\n👉 ${url}`);
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
    if (!message || message.trim().length === 0) {
        console.warn('⚠️ Skipping empty text message');
        return;
    }
    try {
        const resp = await fetchWithRetry(
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
        if (!resp.ok) {
            const errBody = await resp.text();
            console.error(`❌ WhatsApp API Error (${resp.status}):`, errBody);
        }
    } catch (e) {
        console.error("Failed to send text message after retries:", e);
    }
    // Log to CRM
    await logBotMessageToHistory(to, message);
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
    // Log to CRM with button labels
    const logText = message + '\n\n' + buttons.map((b: string) => `▸ ${b}`).join('\n');
    await logBotMessageToHistory(to, logText);
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

        // Log list to CRM with items
        const items = list.sections.flatMap(s => s.rows.map(r => `▸ ${r.title}`)).join('\n');
        await logBotMessageToHistory(to, `${list.header}\n${list.body}\n\n${items}`);

        return true;
    } catch (error) {
        console.error('sendListMessage error:', error);
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
    // Log to CRM
    if (caption) await logBotMessageToHistory(to, `📷 ${caption}`);
}

// --- AUTOMATION: CRON JOBS ---
// Run daily at 14:00 CDMX (20:00 UTC)
// --- AUTOMATION: CRON JOBS ---
// Note: This is now handled by Supabase pg_cron (Database).
// See: supabase/migrations/20260211150000_enable_pg_cron.sql

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
    // --- TELEGRAM CRM WEBHOOK: RECEIVE BUTTON PRESSES & COMMANDS ---
    {
        const url = new URL(req.url);
        if (url.searchParams.get('action') === 'telegram_webhook' && req.method === 'POST') {
            try {
                const update = await req.json();
                const { handleTelegramCallback, handleTelegramCommand } = await import('./telegramService.ts');

                // Create Supabase client for DB operations
                const { createClient } = await import("npm:@supabase/supabase-js@2");
                const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

                // Route: Callback Query (inline button press)
                if (update.callback_query) {
                    return await handleTelegramCallback(update, supabaseClient);
                }

                // Route: Message (commands like /pendientes)
                if (update.message?.text) {
                    return await handleTelegramCommand(update, supabaseClient);
                }

                return new Response("OK", { status: 200 });
            } catch (e) {
                console.error("Telegram Webhook Error:", e);
                return new Response("OK", { status: 200 });
            }
        }
    }

    // --- WEB ORDER BRIDGE: RECEIVE ORDER FROM WEBSITE ---
    {
        const url = new URL(req.url);
        const adminSecret = Deno.env.get('ADMIN_SECRET') || 'yoko_master_key';

        if (url.searchParams.get('action') === 'web_order' && url.searchParams.get('secret') === adminSecret) {
            try {
                const { phone, items, total, name } = await req.json();

                if (!phone || !items) {
                    return new Response("Missing phone or items", { status: 400 });
                }

                console.log(`🌐 Web Order received for ${phone}: $${total}`);

                // 1. Update Session Cart
                const session = await getSession(phone);

                // Map web items to session cart format
                session.cart = items.map((i: any) => ({
                    id: i.id || i.name.toLowerCase().replace(/ /g, '-'),
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                    // If it's a bowl/burger, it might be the only thing they want to check out now
                    customization: i.details ? i.details.map((d: any) => `${d.label}: ${d.value}`).join(', ') : ''
                }));

                session.mode = 'CHECKOUT';
                session.checkoutState = {
                    productSlug: 'web-order',
                    selections: {},
                    totalPrice: total,
                    checkoutStep: 'COLLECT_NAME',
                    customerName: name
                };

                let nextMessage = "";
                if (name) {
                    session.checkoutState.checkoutStep = 'COLLECT_DELIVERY'; // Skip name
                    nextMessage = `✅ *¡Pedido Recibido de la Web!* 🌐\n\nHola *${name}*, ya tengo tu carrito listo del sitio web.\n\n🛒 *Total: $${total}*\n\n¿Cómo quieres recibirlo?`;
                } else {
                    nextMessage = `✅ *¡Pedido Recibido de la Web!* 🌐\n\nYa tengo tu carrito listo.\n\n🛒 *Total: $${total}*\n\nPara confirmar, ¿a qué nombre registro el pedido? 📝`;
                }

                await updateSession(phone, session);

                // 2. Notify User via WhatsApp
                const cartSummary = items.map((i: any) => `• ${i.quantity}x ${i.name}`).join('\n');
                const fullMsg = nextMessage.replace("carrito listo", `carrito listo:\n${cartSummary}`);

                // Send buttons for delivery if skipping name
                if (session.checkoutState.checkoutStep === 'COLLECT_DELIVERY') {
                    await sendWhatsAppButtons(phone, fullMsg, ['🛵 A Domicilio', '🏪 Recoger en Tienda']);
                } else {
                    await sendWhatsAppText(phone, fullMsg);
                }

                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

            } catch (e) {
                console.error("Web Order Bridge Error:", e);
                return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
            }
        }
    }

    // --- ADMIN ACTION: NOTIFY PRE-ORDERS ---
    {
        const url = new URL(req.url);
        const adminSecret = Deno.env.get('ADMIN_SECRET') || 'yoko_master_key';
        if (url.searchParams.get('action') === 'notify_preorders' && url.searchParams.get('secret') === adminSecret) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
            // Reuse logic
            const result = await notifyPreOrders(supabase);

            if (!result.success) {
                return new Response(JSON.stringify({ error: result.error }), { status: 500, headers: { "Content-Type": "application/json" } });
            }

            return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
        }
    }

    // --- MARK AS READ HELPER ---
    async function markMessageAsRead(messageId: string) {
        try {
            // FIRE AND FORGET
            fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: messageId
                })
            }).catch(e => console.error("Error marking read:", e));
        } catch (e) {
            console.error("Error in markMessageAsRead wrapper:", e);
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

        // --- MARK AS READ (Blue Ticks) ---
        if (message.id) {
            markMessageAsRead(message.id);
        }





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
                                await sendWhatsApp(from, {
                                    text: "🙉 Escuché ruido pero no entendí. ¿Podrías escribirlo? 📝",
                                    useButtons: true,
                                    buttons: ['Ver Menú', 'Ayuda']
                                });
                            }
                        } else {
                            console.error("Audio download failed");
                            await sendWhatsApp(from, {
                                text: "⚠️ No pude descargar tu audio. ¿Me lo escribes? 📝",
                                useButtons: true,
                                buttons: ['Ver Menú', 'Ayuda']
                            });
                        }
                    } catch (e) {
                        console.error("Audio processing error:", e);
                    }
                }
                else if (message.type === 'location') {
                    // 📍 LOCATION MESSAGE (Premium UX + Reverse Geocoding)
                    console.log(`📍 Receiving Location from ${from}`);
                    try {
                        const location = message.location;
                        const session = await getSession(from);

                        // Check if we're in checkout waiting for location
                        if (session.mode === 'CHECKOUT' && session.checkoutState?.checkoutStep === 'COLLECT_LOCATION') {
                            // 🌍 REVERSE GEOCODE: Convert GPS → Street Address
                            let resolvedAddress = location.address || location.name || '';
                            try {
                                const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${location.latitude}&lon=${location.longitude}&format=json&addressdetails=1&accept-language=es`;
                                const geoRes = await fetch(geoUrl, {
                                    headers: { 'User-Agent': 'YokoPoke-Bot/1.0' }
                                });

                                if (geoRes.ok) {
                                    const geoData = await geoRes.json();
                                    const addr = geoData.address || {};

                                    // Build human-readable address from components
                                    const parts: string[] = [];
                                    if (addr.road) parts.push(addr.road);
                                    if (addr.house_number) parts.push(`#${addr.house_number}`);
                                    if (addr.neighbourhood || addr.suburb) parts.push(addr.neighbourhood || addr.suburb);
                                    if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);

                                    if (parts.length > 0) {
                                        resolvedAddress = parts.join(', ');
                                    } else if (geoData.display_name) {
                                        // Fallback to full display name, truncated
                                        resolvedAddress = geoData.display_name.split(',').slice(0, 4).join(',').trim();
                                    }

                                    console.log(`📍 Geocoded: ${resolvedAddress}`);
                                }
                            } catch (geoError) {
                                console.error("Geocoding error (non-fatal):", geoError);
                                // Continue with WhatsApp-provided address or empty
                            }

                            // Save location data
                            session.checkoutState.location = {
                                latitude: location.latitude,
                                longitude: location.longitude,
                                address: resolvedAddress
                            };
                            session.checkoutState.fullAddress = resolvedAddress;

                            // Skip COLLECT_ADDRESS → go straight to COLLECT_REFERENCES
                            session.checkoutState.checkoutStep = 'COLLECT_REFERENCES';
                            await updateSession(from, session);

                            const addrPreview = resolvedAddress
                                ? `\n\n📍 *Dirección detectada:*\n${resolvedAddress}`
                                : '';

                            await sendWhatsApp(from, {
                                text: `✅ ¡Ubicación recibida!${addrPreview}\n\n📝 ¿Alguna referencia para el repartidor?\n(Ej: "Portón blanco", "Junto al Oxxo", "Casa azul")`
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
                        // DISABLED: WhatsApp Flows not available (account not verified)
                        console.log("🌸 FLOW RESPONSE received but Flows disabled:", interactive.nfm_reply);
                        await sendWhatsApp(from, {
                            text: "⚠️ Esta función no está disponible por el momento. ¿Qué te gustaría pedir?",
                            useButtons: true,
                            buttons: ['Ver Menú', 'Pokes de la Casa']
                        });
                        return;
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

// --- FLOW RESPONSE HANDLER (DISABLED — cuenta no verificada, WhatsApp Flows no disponible) ---
// async function handleFlowResponse(from: string, flowData: any) { ... }
