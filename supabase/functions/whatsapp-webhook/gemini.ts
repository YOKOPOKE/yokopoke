import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { ProductOption, ProductStep } from "./productService.ts";

const apiKey = Deno.env.get("GEMINI_API_KEY");
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Use 'gemini-3-pro-preview' for maximum reasoning and sales capability (User Request - 2026)
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-3-pro-preview" }) : null;

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

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
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
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (e) {
        return `✅ Listo, agregamos: ${currentSelections.join(', ')}.\nAhora vamos con *${nextStepLabel}*.`;
    }
}

export async function analyzeIntent(
    userText: string,
    history: string[] = [] // Optional history
): Promise<{ intent: string, entities: any }> {
    if (!model) return { intent: 'unknown', entities: {} };

    const historyContext = history.length > 0 ? `HISTORIAL DE CONVERSACIÓN:\n${history.map(m => `- ${m}`).join('\n')}\n` : "";

    // Robust Intent Prompt
    const prompt = `
    Eres un asistente de ventas experto para Yoko Poke. Analiza el ÚLTIMO mensaje del usuario teniendo en cuenta el historial.

    ${historyContext}
    MENSAJE ACTUAL DEL USUARIO: "${userText}"
    
    Tus objetivos son:
    1. Detectar si el usuario quiere ARMAR/PERSONALIZAR un poke desde cero (START_BUILDER).
       - Keywords: "armar", "personalizar", "crear mi propio", "mediano", "grande", "burger" (Sushi Burgers son armables).
       - ESTO ES SOLO PARA "POKE MEDIANO", "POKE GRANDE" O "SUSHI BURGERS".
    
    2. Detectar si quiere pedir un producto DEL MENU / CARTA (ADD_TO_CART).
       - Productos fijos: "Pokes de la Casa" (Spicy Tuna, Yoko Especial, etc), "Bebidas", "Postres", "Entradas".
       - Si dice "dame un spicy tuna" -> ADD_TO_CART.
       - Si dice "spicy tuna" (nombre exacto del producto) -> ADD_TO_CART.
       - Si dice "tienes pokes de la casa?" -> CATEGORY_FILTER.

    3. Detectar preguntas informativas (INFO) o estatus de pedido (STATUS).
    
    Salida JSON esperada:
    {
        "intent": "START_BUILDER" | "ADD_TO_CART" | "CATEGORY_FILTER" | "INFO" | "STATUS" | "CHAT",
        "product_hint": string | null, // Ej: "coca cola", "spicy tuna", "mediano"
        "category_keyword": string | null // Ej: "bebida", "postre"
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
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
}

/**
 * Generates a conversational response AND determines if an image should be shown.
 */
export async function generateSalesResponse(
    userText: string,
    menuContext: string,
    productList: any[] // Pass full products to find images
): Promise<SalesResponse> {
    if (!model) return { text: "¡Hola! ¿En qué te puedo ayudar hoy? 🥗" };

    const productImagesContext = productList
        .filter(p => p.image_url)
        .map(p => `Product: "${p.name}" -> ImageURL: "${p.image_url}"`)
        .join("\n");

    // Sales Prompt
    const prompt = `
    ACT AS: "Yoko Bot", the best waiter at Yoko Poke.
    GOAL: SELL. Be helpful, persuasive, and VISUAL.
    
    MENU AVAILABLE:
    ${menuContext}
    
    IMAGES AVAILABLE (Use these URLs if explicitly asked or if recommending a specific hero product):
    ${productImagesContext}
    
    USER MESSAGE: "${userText}"
    
    INSTRUCTIONS:
    1. IF USER ASKS FOR MENU ITEM (e.g. "Spicy Tuna", "Bebidas", "Postre"):
       - SELL IT! Describe it deliciously using the menu info.
       - RETURN ITS IMAGE URL in the JSON if available.
       - **IF USER SAYS "SIN [ingrediente]" or "QUITAR [ingrediente]" or "NO QUIERO [ingrediente]"**:
         * Acknowledge it warmly: "¡Claro! Lo preparamos sin [ingrediente] para ti. Quedará delicioso. 😊"
         * EXPLAIN they should use the builder if they want exact customization: "Para armarlo a tu gusto exacto con todos los cambios, usa https://yokopoke.mx/#product-selector"
         * DO NOT add product to cart if heavy modification is requested.
       - SUGGEST ordering it ("¿Te lo marcho?", "¡Excelente elección!").
    
    2. IF USER WANTS TO CUSTOMIZE/BUILD (e.g. "Make my own", "Swap ingredients", "Armar", "Sin pícate"):
       - POLITELY REDIRECT to the web builder: https://yokopoke.mx/#product-selector
       - Say something like: "¡Sin problema! 😊 Para quitar el pícate y armarlo a tu gusto exacto, usa nuestro constructor interactivo aquí: [URL]. ¡Quedará delicioso! 🥣✨".

    3. IF USER ASKS FOR GENERAL MENU or CATEGORY (e.g. "Show menu", "What drinks?", "Postres"):
       - RETURN A LIST STRUCTURE in the JSON.
       - "listData" must include: title (Category Name), rows (Array of {id: "Product Name", title: "Product Name + Emoji", description: "Price + Short Ingredients"}).
       - Max 10 items per list.
    
    4. IF USER WANTS TO FINALIZE ORDER ("Finalizar pedido", "Checkout", "Ya está", "Esto es todo"):
       - Ask for their name in a friendly way: "¡Perfecto! Para procesar tu orden, ¿a qué nombre la dejo?"
       - NO BUTTONS. Let them type.
    
    5. **BUTTON LIMITS**:
       - ONLY provide "suggested_actions" if ABSOLUTELY NECESSARY (e.g., "Agregar al carrito", "Finalizar pedido").
       - MAX 2 BUTTONS. No more.
       - If asking a question, DO NOT use buttons. Let them TYPE.
       - NEVER suggest "Ver Bebidas", "Ver Postres" buttons unless explicitly relevant.
    
    6. Keep text under 200 chars. Use minimal emojis (🥗, 🔥, 😊).
    7. return JSON ONLY.
    
    OUTPUT FORMAT:
    {
      "text": "Intro text (e.g. 'Aquí tienes nuestros favoritos 👇')",
      "show_image_url": "https://... (or null)",
      "suggested_actions": ["MAX 2 ACTIONS"],
      "useList": true/false,
      "listData": {
        "title": "Sección del Menú",
        "rows": [
          { "id": "spicy_tuna", "title": "🌶️ Spicy Tuna", "description": "$160 - Atún, pepino, spicy mayo" }
        ]
      }
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (e) {
        console.error("Gemini Sales Error:", e);
        return { text: "¡Hola! Se me antojó un Poke. ¿Quieres ver el menú o armar uno? 🥗" };
    }
}
