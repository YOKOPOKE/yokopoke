import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { ProductOption, ProductStep } from "./productService.ts";

const apiKey = Deno.env.get("GEMINI_API_KEY");
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Use 'gemini-3-pro-preview' for maximum reasoning and sales capability (User Request - 2026)
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-3-pro-preview" }) : null;

// Helper for Robustness
async function generateContentWithRetry(input: any, retries = 2): Promise<any> {
    if (!model) throw new Error("Model not initialized");

    for (let i = 0; i <= retries; i++) {
        try {
            return await model.generateContent(input);
        } catch (e: any) {
            console.warn(`⚠️ Gemini API Error (Attempt ${i + 1}/${retries + 1}):`, e.message);

            // Don't retry client errors (4xx) — they won't succeed on retry
            const status = e.status || e.httpStatusCode || 0;
            if (status >= 400 && status < 500) throw e;

            // If it's the last attempt, throw.
            if (i === retries) throw e;

            // Exponential Backoff: 500ms, 1000ms, 2000ms
            const delay = 500 * Math.pow(2, i);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

/**
 * Interprets user selection using advanced logic (Slang, context, implicit)
 */
export async function interpretSelection(
    userText: string,
    availableOptions: ProductOption[]
): Promise<number[]> {
    if (!model) {
        console.error("Gemini API Key not found");
        return [];
    }

    try {
        const optionsList = availableOptions.map(o => `${o.id}: ${o.name}`).join("\n");

        const prompt = `
        ACT AS: An expert, persuasive Poke Bowl waiter who wants to sell.
        CONTEXT: The user is selecting ingredients for a specific step.
        USER INPUT: "${userText}"
        AVAILABLE OPTIONS (ID: Name):
        ${optionsList}

        TASK: Identify which Option IDs the user intends to select.
        RULES:
        1. Handle synonyms/slang (e.g. "arrocito" -> "Arroz", "palta" -> "Aguacate").
        2. Handle explicit mentions perfectly.
        3. If user says "everything" or "all", return IDs for all options (respecting logic if implicit).
        4. If user says "none" or "skip", return empty list [].
        5. Ignore unrelated text.
        
        OUTPUT: Return ONLY a JSON array of numbers. Example: [101, 102].
        `;

        const result = await generateContentWithRetry(prompt);
        const text = result.response.text();
        // Robust JSON extraction: Find first { and last }
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanText = jsonMatch ? jsonMatch[0] : text.replace(/```json/g, '').replace(/```/g, '').trim();
        const ids = JSON.parse(cleanText);

        return Array.isArray(ids) ? ids : [];
    } catch (error) {
        console.error("Error interpreting selection:", error);
        return [];
    }
}

/**
 * Generates a friendly, conversational response based on the current context.
 */
export async function generateConversationalResponse(
    stepLabel: string,
    currentSelections: string[], // Names of what user JUST picked
    nextStepLabel: string,
    remainingCount: { included: number, absolute: number | 'varios' },
    fullSummary?: string // NEW: Summary of all previous steps
): Promise<string> {
    if (!model) return `✅ Llevas: ${currentSelections.join(', ')}. Siguiente: ${nextStepLabel}.`;

    const prompt = `
    ACT AS: "Yoko Bot", a world-class sales waiter at Yoko Poke.
    TONE: Enthusiastic but Professional. "Human-like". Short.
    USE EMOJIS: MINIMAL. Only basic ones like 🥗, ✅, 🔥. No emoji spam.
    GOAL: Make the user feel great about their choice and excited for the next one.
    
    SITUATION:
    - User has selected: ${currentSelections.length > 0 ? currentSelections.join(', ') : 'Nothing yet'}.
    - Current Step Completed: ${stepLabel}.
    - Next Step: ${nextStepLabel}.
    - Remaining allowed choices in next step: Included: ${remainingCount.included} (Total allowed: ${remainingCount.absolute}).
    - Full Order Summary So Far: ${fullSummary || 'N/A'}.
    
    GUIDANCE:
    - Briefly acknowledge what they have so far (e.g. "Excellent with the Base and Protein!").
    - If user has NOT reached included limit: "Te falta elegir X más (incluidos)."
    - If user HAS reached included limit but can add more: "¡Listo! ¿Quieres agregar algo más (costo extra) o seguimos?" DO NOT say "Te faltan X". Allow them to stop.
    
    TASK: Write a short message (max 160 chars) confirming the selection and guiding to the next step.
    - If they picked a premium item, compliment it ("¡Uff, gran elección con el Salmón! 🐟").
    - Create craving for the next step ("Ahora, vamos a darle color con los *${nextStepLabel}*").
    - Be concise but "selling".
    
    OUTPUT: The message string only.
    `;

    try {
        const result = await generateContentWithRetry(prompt);
        return result.response.text().trim();
    } catch (e) {
        return `✅ Listo, agregamos: ${currentSelections.join(', ')}.\nAhora vamos con *${nextStepLabel}*.`;
    }
}

export async function analyzeIntent(
    userText: string,
    history: string[] = [],
    cart: any[] = [] // NEW: Cart Context
): Promise<{ intent: string, entities: any }> {
    if (!model) return { intent: 'unknown', entities: {} };

    const historyContext = history.length > 0 ? `HISTORIAL DE CONVERSACIÓN:\n${history.map(m => `- ${m}`).join('\n')}\n` : "";
    const cartContext = cart.length > 0 ? `CARRITO ACTUAL (${cart.length} items): ${cart.map(i => i.name).join(', ')}` : "CARRITO VACÍO";

    // Robust Intent Prompt
    const prompt = `
    Eres un asistente de ventas experto para Yoko Poke. Analiza el ÚLTIMO mensaje del usuario.

    ${historyContext}
    ${cartContext}
    MENSAJE ACTUAL DEL USUARIO: "${userText}"
    
    Tus objetivos son:
    1. Detectar si el usuario quiere ARMAR/PERSONALIZAR un poke (CHAT).
       - Keywords: "armar", "personalizar", "crear mi propio", "mediano", "grande".
       - NOTA: La personalización se hace en la web (yokopoke.mx). Devuelve CHAT para que el bot le redirija.
    
    2. Detectar si quiere pedir un producto DEL MENU / CARTA (ADD_TO_CART).
       - Productos fijos: "Pokes de la Casa" (Spicy Tuna, Yoko Especial, etc), "Bebidas", "Postres", "Entradas", "Sushi Burgers".
       - Si dice "dame un spicy tuna" -> ADD_TO_CART.
       - Si dice "spicy tuna" (nombre exacto del producto) -> ADD_TO_CART.
       - Si dice "y también unas gyozas" (CONTEXTO: ya pidió algo) -> ADD_TO_CART.

    3. Detectar si quiere VER UNA CATEGORÍA o EL MENÚ (CATEGORY_FILTER).
       - Si dice "ver menú", "la carta", "qué tienes": CATEGORY_FILTER (sin keyword).
       - Si dice "ver bebidas", "postres", "entradas": CATEGORY_FILTER (keyword="bebida", "postre").
       
    4. Detectar PREGUNTAS ABIERTAS o SOLICITUD DE RECOMENDACIONES (CHAT).
       - Si dice "¿qué me recomiendas?", "algo rico", "no sé qué pedir": CHAT.
       - Si dice "algo de beber" (sin especificar, pidiendo sugerencia): CHAT (para que el Bot venda).
       - Si dice "cuales son los ingredientes del Spicy Tuna?": CHAT.

    5. Detectar si quiere FINALIZAR PEDIDO (CHECKOUT).
       - Keywords: "finalizar", "pagar", "confirmar", "checkout", "ya está", "eso es todo".
       - SI TIENE ITEMS EN EL CARRITO y dice "listo" o "ya", es CHECKOUT.
       
    Salida JSON esperada:
    {
        "intent": "ADD_TO_CART" | "CATEGORY_FILTER" | "INFO" | "STATUS" | "CHAT" | "CHECKOUT",
        "product_hint": string | null,
        "category_keyword": string | null
    }
    `;

    try {
        const result = await generateContentWithRetry(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanText = jsonMatch ? jsonMatch[0] : text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        return { intent: 'unknown', entities: {} };
    }
}

export interface SalesResponse {
    text: string;
    show_image_url?: string;
    suggested_actions?: string[];
    useList?: boolean;
    listData?: {
        title: string;
        rows: Array<{ id: string, title: string, description: string }>;
    };
    // Server actions — supports MULTIPLE products
    server_action?: {
        type: "ADD_TO_CART";
        products: Array<{ id: string, name: string, price: number, quantity: number }>;
    };
    // Legacy single-product support (backwards compat)
    server_action_legacy?: {
        type: "ADD_TO_CART";
        product: { id: string, name: string, price: number, quantity: number };
    };
}

/**
 * Generates a conversational response AND determines if an image should be shown.
 */
export async function generateSalesResponse(
    userText: string,
    menuContext: string,
    productList: any[],
    cart: any[] = [],
    conversationHistory: Array<{ role: string, text: string }> = [],
    customerProfile?: { favorites?: string[], orderCount?: number }
): Promise<SalesResponse> {
    if (!model) return { text: "¡Hola! ¿En qué te puedo ayudar hoy? 🥗" };

    const productImagesContext = productList
        .filter(p => p.image_url)
        .map(p => `Product: "${p.name}" -> ImageURL: "${p.image_url}"`)
        .join("\n");

    const cartDescription = cart.length > 0
        ? `User has in cart: ${cart.map(c => `${c.name} ($${c.price})`).join(', ')}. Total: $${cart.reduce((s: number, c: any) => s + (c.price * (c.quantity || 1)), 0)}`
        : "Cart is empty.";

    // 🧠 Conversation History Context
    const historyContext = conversationHistory.length > 0
        ? `CONVERSACIÓN RECIENTE (para entender contexto):\n${conversationHistory.map(m => `${m.role === 'user' ? '👤 Cliente' : '🤖 Poki'}: ${m.text.substring(0, 100)}`).join('\n')}\n`
        : "";

    // 👤 Customer DNA Context
    const customerContext = customerProfile
        ? `PERFIL DEL CLIENTE: ${customerProfile.orderCount || 0} pedidos previos. Favoritos: ${customerProfile.favorites?.join(', ') || 'Nuevo cliente'}.`
        : "CLIENTE NUEVO (primera vez).";

    // 💰 Upselling Rules
    const hasFood = cart.some(c => !['Coca Cola', 'Calpico', 'Agua', 'Limonada'].some(b => c.name.includes(b)));
    const hasBeverage = cart.some(c => ['Coca Cola', 'Calpico', 'Agua', 'Limonada'].some(b => c.name.includes(b)));

    let upsellHint = '';
    if (hasFood && !hasBeverage) upsellHint = 'UPSELL: El cliente tiene comida pero NO bebida. Sugiere sutilmente una bebida.';
    else if (cart.length === 0) upsellHint = 'UPSELL: Carrito vacío. Si recomiendas algo, empieza por los más vendidos.';

    // Sales Prompt (compacted for clarity)
    const prompt = `
    ERES: "Poki", el asistente virtual de Yoko Poke.
    OBJETIVO: VENDER y GUIAR. Sé amable, breve y cálido.
    IDIOMA: Español siempre. Tutea al cliente.
    
    ${historyContext}
    MENÚ DISPONIBLE:
    ${menuContext}
    
    IMÁGENES:
    ${productImagesContext}
    
    CONTEXTO:
    ${cartDescription}
    ${customerContext}
    ${upsellHint}
    MENSAJE DEL USUARIO: "${userText}"
    
    REGLAS:
    1. RESPONDE DIRECTO como Poki. No ofrezcas "opciones de respuesta". No rompas personaje.
    2. USA EL HISTORIAL para entender contexto (ej: "Y de tomar?" = pregunta por bebidas).
    3. Si el usuario PIDE UN PRODUCTO ("Dame X", "Agrega X", "Quiero X"):
       - OBLIGATORIO: devuelve "server_action" con los productos en el array "products".
       - Si pide VARIOS ("gyozas y una coca"), agrega TODOS.
       - Confirma: "¡Listo! Agregué X y Y a tu orden. 🥟🥤"
       - Si TAMBIÉN hizo una pregunta, RESPÓNDELA en el texto.
    4. Si quiere PERSONALIZAR ("armar", "sin cebolla"): Redirige a https://yokopoke.mx/#product-selector. NO armes en chat.
    5. Si pide VER MENÚ o CATEGORÍA: devuelve "listData" con title, rows (id, title, description). Max 10 items.
    6. Si quiere FINALIZAR ("eso es todo", "listo"): Responde "¡Perfecto! ¿A qué nombre registro tu pedido?"
    7. DESPUÉS DE AGREGAR AL CARRITO: incluye "Ver Menú" en suggested_actions. Si tiene comida pero no bebida, sugiere una.

    SALIDA: SOLO el JSON. Sin preámbulos. Sin "Opción 1/2".
    {
      "text": "Respuesta",
      "show_image_url": "URL o null",
      "suggested_actions": ["MAX 2 botones"],
      "server_action": { "type": "ADD_TO_CART", "products": [{ "id": "slug", "name": "Nombre", "price": 120, "quantity": 1 }] } | null
    }
    `;

    try {
        const result = await generateContentWithRetry(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanText = jsonMatch ? jsonMatch[0] : text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanText);

        // Backwards compat: if AI returns old single-product format, convert to array
        if (parsed.server_action?.product && !parsed.server_action?.products) {
            parsed.server_action.products = [parsed.server_action.product];
            delete parsed.server_action.product;
        }

        return parsed;
    } catch (e) {
        console.error("Gemini Sales Error:", e);
        return { text: "¡Hola! Se me antojó un Poke. ¿Quieres ver el menú o armar uno? 🥗" };
    }
}

/**
 * Transcribes Audio (Voice Notes) into Text using Gemini Multimodal
 */
export async function transcribeAudio(audio: { mimeType: string; data: string }): Promise<string> {
    if (!model) return "";

    try {
        const result = await generateContentWithRetry([
            {
                inlineData: {
                    mimeType: audio.mimeType,
                    data: audio.data
                }
            },
            { text: "Transcribe este audio exactamente como fue dicho. Retorna SOLO el texto plano, sin comentarios ni formato." }
        ]);

        return result.response.text().trim();
    } catch (e) {
        console.error("Audio Transcription Error:", e);
        return ""; // Fallback to empty (will be handled as empty message)
    }
}

/**
 * Generate Personalized Greeting based on Order History (Premium UX)
 */
export async function generatePersonalizedGreeting(
    customerPhone: string,
    orderHistory: Array<{ items: Array<{ name: string; quantity: number }>, order_date: string }>
): Promise<string> {
    if (!model) return "¡Hola! Bienvenido a Yoko Poke 🥗";

    try {
        let historyContext = "";

        if (orderHistory.length > 0) {
            // Extract item names from history
            const allItems = orderHistory.flatMap(order =>
                order.items.map(item => item.name)
            );
            const favoriteItems = [...new Set(allItems)].slice(0, 3).join(", ");

            const lastOrderDate = new Date(orderHistory[0].order_date).toLocaleDateString('es-MX');

            historyContext = `
CONTEXTO: Cliente que regresa.
TU NOMBRE: Poki.

TAREA: Genera un saludo alegre:
1. "Hola de nuevo! Soy Poki 🐼".
2. Menciona sutilmente lo anterior ("Veo que te gusta el Spicy Tuna").
3. INVITACIÓN CLARA: "Recuerda que en yokopoke.mx es más rápido pedir y ver fotos 📸".
`;
        } else {
            historyContext = `
CONTEXTO: Cliente nuevo
OBJETIVO: GENERAR EL MENSAJE FINAL EXACTO. NO DATOS ADICIONALES.

TAREA: Genera un saludo AMIGABLE con EMOJIS (moderados) que use esta estructura:
1. Saludo cálido: "¡Hola! Soy Poki 🐼, tu asistente virtual."
2. Push Web (Principal): "Te invito a ordenar en nuestra web yokopoke.mx 📲 ¡Es mucho más fácil, rápido y puedes ver fotos de todo! 📸"
3. Opción Chat (Secundaria): "O si prefieres, puedo tomar tu orden por aquí. ¿Qué se te antoja hoy? 🥢"

REGLAS CRÍTICAS DE SALIDA:
1. SOLO ENTREGA EL MENSAJE. NADA MÁS.
2. NO ESCRIBAS "Aquí tienes una propuesta".
3. NO ESCRIBAS "Opción recomendada".
4. SI ESCRIBES ALGO QUE NO SEA EL SALUDO, EL SISTEMA FALLARÁ.
`;
        }

        const result = await generateContentWithRetry(historyContext);
        let greeting = result.response.text().trim();

        // Strip common Gemini meta-text preamble
        const metaPrefixes = [
            /^(Aqu[ií] tienes?[^:]*:|Claro[^:]*:|Opci[oó]n[^:]*:|Propuesta[^:]*:|Respuesta[^:]*:)\s*/i,
            /^(Here'?s?[^:]*:|Option[^:]*:)\s*/i
        ];
        for (const regex of metaPrefixes) {
            greeting = greeting.replace(regex, '');
        }
        // Strip wrapping quotes if Gemini wrapped the whole thing
        if (greeting.startsWith('"') && greeting.endsWith('"')) {
            greeting = greeting.slice(1, -1);
        }

        return greeting || "¡Hola! ¿Qué se te antoja hoy? 🥗";

    } catch (e) {
        console.error("Personalized Greeting Error:", e);
        return "¡Hola! Bienvenido a Yoko Poke 🥗 ¿Qué te preparamos hoy?";
    }
}
