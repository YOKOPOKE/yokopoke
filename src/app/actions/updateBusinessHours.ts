"use server";

import { createClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function updateBusinessHours(open: number, close: number) {
    const supabase = createClient();

    try {
        // Validate inputs
        if (!Number.isInteger(open) || !Number.isInteger(close)) {
            return { success: false, error: "Las horas deben ser números enteros." };
        }
        if (open < 0 || open > 23 || close < 0 || close > 23) {
            return { success: false, error: "Horas inválidas (0-23)." };
        }
        if (open >= close) {
            return { success: false, error: "La hora de apertura debe ser antes del cierre." };
        }

        const { error } = await supabase
            .from('app_config')
            .update({ value: { open, close } })
            .eq('key', 'business_hours');

        if (error) {
            console.error("Error updating business hours:", error);
            return { success: false, error: "Error al actualizar horario." };
        }

        revalidatePath('/');
        revalidatePath('/admin');

        return { success: true };
    } catch (e) {
        console.error("Server Action Error:", e);
        return { success: false, error: "Error interno del servidor." };
    }
}
