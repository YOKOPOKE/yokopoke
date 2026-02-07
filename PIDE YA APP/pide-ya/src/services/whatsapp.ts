/**
 * Servicio de Integración con WhatsApp API -> "Pide Ya"
 * -----------------------------------------------------
 * Configuración de credenciales y métodos para envío de mensajes.
 * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

// Validación de entorno para el servicio (solo servidor o edge functions si aplica, pero aquí es referencia)
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_VERSION = 'v18.0';

interface WhatsAppResponse {
    messaging_product: string;
    contacts: { input: string; wa_id: string }[];
    messages: { id: string }[];
}

interface WhatsAppError {
    error: {
        message: string;
        type: string;
        code: number;
        fbtrace_id: string;
    };
}

export const whatsappService = {
    /**
     * Enviar mensaje de texto simple.
     * @param to Número de teléfono destino (e.g. "521...")
     * @param message Cuerpo del mensaje
     */
    async sendMessage(to: string, message: string): Promise<{ success: boolean; data?: WhatsAppResponse; error?: string }> {
        // En desarrollo, podemos simular el envío si no hay credenciales (o lanzar error si queremos ser estrictos)
        if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
            console.warn('[WHATSAPP] Credenciales faltantes. Mensaje simulado en consola.');
            console.log(`[WHATSAPP-MOCK] To: ${to} | Body: ${message}`);
            return { success: true };
        }

        try {
            const url = `https://graph.facebook.com/${WHATSAPP_VERSION}/${WHATSAPP_PHONE_ID}/messages`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'text',
                    text: { preview_url: false, body: message },
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                const errorData = data as WhatsAppError;
                console.error('[WHATSAPP] Error en API:', errorData.error.message);
                return { success: false, error: errorData.error.message };
            }

            return { success: true, data: data as WhatsAppResponse };
        } catch (error) {
            console.error('[WHATSAPP] Error de red o inesperado:', error);
            return { success: false, error: 'Network or unexpected error' };
        }
    },

    /**
     * Enviar actualización de lealtad.
     */
    async sendLoyaltyUpdate(to: string, currentStamps: number) {
        const stampsLeft = 6 - currentStamps;
        const message = `¡Hola de nuevo! 🚚\n\nActualización de *Pide Ya*:\nTienes *${currentStamps} de 6* sellos acumulados.\n¡Solo te faltan *${stampsLeft}* para tu envío GRATIS!`;
        return this.sendMessage(to, message);
    },

    /**
     * Enviar notificación de recompensa disponible.
     */
    async sendRewardUnlocked(to: string) {
        const message = `🎉 *¡FELICITACIONES!* 🎉\n\nHas completado tu tarjeta de lealtad en *Pide Ya*.\n\nTu próximo envío es *TOTALMENTE GRATIS*. ¡Aprovéchalo ahora!`;
        return this.sendMessage(to, message);
    },

    /**
     * Enviar recordatorio de inactividad.
     */
    async sendInactivityReminder(to: string) {
        const message = `👋 Hola, te extrañamos en *Pide Ya*.\n\nHace más de 24 horas no realizas envíos.\n¿Necesitas ayuda con algún pedido? Estamos aquí para ti.`;
        return this.sendMessage(to, message);
    }
};
