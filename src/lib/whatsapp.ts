import { createClient } from '@/lib/supabase';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0'; // Updated to recent version

type WhatsAppTemplate = {
    name: string;
    language: { code: string };
    components: any[];
};

export async function sendWhatsAppMessage(
    to: string,
    templateName: string,
    variables: string[] = [],
    languageCode: string = 'es_MX'
) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
        console.warn('⚠️ WhatsApp credentials missing. Message mocked:', { to, templateName, variables });
        return { success: true, mocked: true };
    }

    try {
        // Construct the payload for a template message
        // This is a simplified handler assuming basic 'body' variables for now
        const components = variables.length > 0 ? [{
            type: 'body',
            parameters: variables.map(v => ({ type: 'text', text: v }))
        }] : [];

        const body = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'template',
            template: {
                name: templateName,
                language: { code: languageCode },
                components: components
            }
        };

        const response = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ WhatsApp API Error:', data);
            return { success: false, error: data };
        }

        return { success: true, data };

    } catch (error) {
        console.error('❌ WhatsApp Network Error:', error);
        return { success: false, error };
    }
}

// Admin Notification Helper
export async function notifyAdminNewOrder(orderId: string, customerName: string, total: number) {
    const ADMIN_PHONE = '529631371902'; // Yoko Poke House Admin

    // Template: new_order_alert (needs to be created in Meta dashboard)
    // Variables: {{1}} = Customer Name, {{2}} = Order ID, {{3}} = Total
    return sendWhatsAppMessage(
        ADMIN_PHONE,
        'new_order_alert',
        [customerName, `#${orderId}`, `$${total.toFixed(2)}`]
    );
}
