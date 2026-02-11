"use server";

import { createClient } from "@/lib/supabase";

export async function getBusinessHours() {
    const supabase = createClient();
    const defaultHours = { open: 14, close: 22 };

    try {
        const { data, error } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'business_hours')
            .single();

        if (error || !data) {
            // console.warn("Using default business hours (DB fallback):", error); // optional logging
            return defaultHours;
        }

        const config = data.value;
        return {
            open: Number(config.open) || 14,
            close: Number(config.close) || 22
        };
    } catch (e) {
        console.error("Error fetching business hours:", e);
        return defaultHours;
    }
}
