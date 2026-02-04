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
    checkoutStep: 'COLLECT_NAME' | 'COLLECT_DELIVERY' | 'COLLECT_ADDRESS' | 'COLLECT_PICKUP_TIME' | 'SHOW_SUMMARY' | 'CONFIRMATION';
    pickupTime?: string;
    address?: string;
    flowData?: any; // Store data from Flow
}

export interface SessionData {
    mode: 'NORMAL' | 'BUILDER' | 'CHECKOUT';
    builderState?: BuilderState;
    checkoutState?: CheckoutState;
    lastInteraction: number;
    pendingMessages?: string[];
    bufferUntil?: number;
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
