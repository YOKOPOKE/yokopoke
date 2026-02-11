import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export interface BuilderState {
    stepIndex: number;
    productSlug: string;
    selections: Record<number, number[]>;
    totalPrice: number;
}

export interface CheckoutState {
    productSlug: string;
    selections: Record<number, number[]>;
    totalPrice: number;
    customerName?: string;
    deliveryMethod?: 'pickup' | 'delivery';
    checkoutStep: 'COLLECT_NAME' | 'COLLECT_DELIVERY' | 'COLLECT_LOCATION' | 'COLLECT_ADDRESS' | 'COLLECT_REFERENCES' | 'COLLECT_PICKUP_TIME' | 'SHOW_SUMMARY' | 'CONFIRMATION';
    pickupTime?: string;
    address?: string; // Legacy field, will be replaced by fullAddress
    flowData?: any; // Store data from Flow

    // NEW: Location & Address for Premium Delivery
    location?: {
        latitude: number;
        longitude: number;
        address?: string; // From WhatsApp if provided
    };
    fullAddress?: string; // "Calle X #123, Colonia Y"
    addressReferences?: string; // "Casa azul, portón negro"
}

export interface SessionData {
    mode: 'NORMAL' | 'BUILDER' | 'CHECKOUT' | 'PAUSED';
    builderState?: BuilderState;
    checkoutState?: CheckoutState;
    lastInteraction: number;

    // CONCURRENCY & ROBUSTNESS
    processingStart?: number; // Timestamp when lock was acquired
    isProcessing?: boolean;   // Mutex lock
    pendingMessages?: {       // Message Queue
        text: string;
        type: 'text' | 'audio' | 'image' | 'location';
        timestamp: number;
        payload?: any;        // For location/media data
    }[]; // Queue of incoming messages

    // ERROR TRACKING
    errorCount?: number;      // Circuit breaker for session resets
    lastError?: string;       // Debug info

    // RATE LIMITING
    rateLimit?: {
        points: number;       // Remaining quota (e.g. 20)
        lastReset: number;    // Timestamp of last refill
    };

    // HUMAN MODE
    pausedUntil?: number;

    // PERSISTENCE (The Memory)
    cart?: Array<{
        id: string; // SKU or Slug
        name: string;
        price: number;
        quantity: number;
        customization?: string; // "Sin cebolla", "Extra spicy"
    }>;

    // Legacy / Other
    bufferUntil?: number;
    activeThreadId?: string;
}

export async function getSession(phone: string): Promise<SessionData> {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
        const { data, error } = await supabase
            .from('whatsapp_sessions')
            .select('state')
            .eq('phone', phone)
            .single();

        if (error || !data) {
            return { mode: 'NORMAL', lastInteraction: Date.now() };
        }

        return data.state as SessionData;
    } catch (err) {
        console.error('Error getting session:', err);
        return { mode: 'NORMAL', lastInteraction: Date.now() };
    }
}

export async function updateSession(phone: string, newState: SessionData) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
        const { error } = await supabase
            .from('whatsapp_sessions')
            .upsert({
                phone,
                state: newState,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
    } catch (err) {
        console.error('Error updating session:', err);
    }
}

export async function clearSession(phone: string) {
    await updateSession(phone, { mode: 'NORMAL', lastInteraction: Date.now() });
}
