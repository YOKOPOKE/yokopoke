import { GoogleGenerativeAI } from "@google/generative-ai";
import { ProductOption } from "./productService";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Modelo ligero para rapidez
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

// Sanitize user input to mitigate prompt injection
const VALID_INTENTS = ['START_BUILDER', 'ADD_TO_CART', 'INFO', 'STATUS', 'OTHER', 'unknown'];

function sanitizeUserInput(text: string): string {
    // Truncate to prevent excessively long inputs
    let sanitized = text.slice(0, 500);
    // Strip common adversarial prompt injection patterns
    sanitized = sanitized
        .replace(/ignora\s+(todo|las|lo|el|la)/gi, '')
        .replace(/ignore\s+(all|everything|above|previous)/gi, '')
        .replace(/olvida\s+(todo|las|lo)/gi, '')
        .replace(/forget\s+(all|everything)/gi, '')
        .replace(/new\s+instructions?/gi, '')
        .replace(/system\s*prompt/gi, '')
        .replace(/act\s+as/gi, '')
        .replace(/you\s+are\s+now/gi, '')
        .trim();
    return sanitized;
}

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
        Eres el "Cerebro Lógico" de un sistema de pedidos para Yoko Poke. Tu ÚNICA función es mapear texto de usuario a IDs numéricos válidos.

        CONTEXTO:
        El usuario está eligiendo ingredientes para un paso específico (ej: Proteínas, Toppings).
        
        OPCIONES VÁLIDAS (ID: Nombre):
        ${optionsList}

        ENTRADA DEL USUARIO: "${sanitizeUserInput(userText)}"

        REGLAS DE ORO:
        1. SOLO puedes devolver IDs que estén en la lista de "OPCIONES VÁLIDAS".
        2. Si el usuario menciona algo que suena parecido, usa tu sentido común (ej: "arrocito" -> coincide con "Arroz Gohan").
        3. Si el usuario dice "todo eso", "ambos", o lista varios items, devuelve TODOS los IDs correspondientes.
        4. Si el usuario dice algo que NO coincide con ninguna opción (ej: "pizza", "nada", "siguiente"), devuelve una lista vacía []. NO inventes IDs.
        5. Tu respuesta debe ser EXCLUSIVAMENTE un array JSON de números. Sin markdown, sin explicaciones.

        Ejemplo de Salida: [101, 104]
        `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Limpiar bloques de código si existen
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        let ids: number[] = JSON.parse(cleanText);

        if (!Array.isArray(ids)) {
            console.warn("Gemini returned non-array JSON:", ids);
            return [];
        }

        // --- VALIDACIÓN ESTRICTA (ANTI-ALUCINACIONES) ---
        // Filtramos cualquier ID que la IA haya inventado y que no exista en availableOptions
        const validIds = ids.filter(id => availableOptions.some(opt => opt.id === id));

        if (ids.length !== validIds.length) {
            console.warn(`Gemini Hallucination detected! Filtered out invalid IDs. Original: ${ids}, Valid: ${validIds}`);
        }

        return validIds;
    } catch (error) {
        console.error("Error interpreting selection with Gemini:", error);
        return [];
    }
}

export async function analyzeIntent(
    userText: string,
    history: string[] = []
): Promise<{ intent: string, entities: any }> {
    if (!model) return { intent: 'unknown', entities: {} };

    const historyContext = history.length > 0
        ? `HISTORIAL DE CONVERSACIÓN (Últimos mensajes):\n${history.map(m => `- ${m}`).join('\n')}\n`
        : "";

    const prompt = `
    Eres un asistente de ventas experto para Yoko Poke. Analiza el ÚLTIMO mensaje del usuario teniendo en cuenta el historial.

    ${historyContext}
    MENSAJE ACTUAL DEL USUARIO: "${sanitizeUserInput(userText)}"
    
    Tus objetivos son:
    1. Detectar si el usuario quiere armar un poke desde cero (START_BUILDER).
    2. Detectar si quiere pedir un producto directo (ADD_TO_CART), como "un poke de la casa", "una coca", "postre".
    3. Detectar preguntas informativas (INFO) o estatus de pedido (STATUS).
    
    Salida JSON esperada:
    {
        "intent": "START_BUILDER" | "ADD_TO_CART" | "INFO" | "STATUS" | "OTHER",
        "product_hint": string | null, // Ej: "coca cola", "spicy tuna", "mediano"
        "quantity": number // Default 1
    }

    Ejemplos:
    - "Quiero armar un poke" -> { "intent": "START_BUILDER" }
    - "Dame un spicy tuna" -> { "intent": "ADD_TO_CART", "product_hint": "spicy tuna" }
    - "Tienes coca?" -> { "intent": "ADD_TO_CART", "product_hint": "coca" } (Asumimos intención de compra si es específico)
    - "Donde estan?" -> { "intent": "INFO" }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);

        // Validate intent against whitelist
        if (!VALID_INTENTS.includes(parsed.intent)) {
            console.warn(`Gemini returned invalid intent: ${parsed.intent}. Defaulting to 'unknown'.`);
            parsed.intent = 'unknown';
        }

        return parsed;
    } catch (e) {
        console.error("Gemini Intent Error:", e);
        return { intent: 'unknown', entities: {} };
    }
}
