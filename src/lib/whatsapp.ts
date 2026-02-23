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
    const ADMIN_PHONE = process.env.WHATSAPP_ADMIN_PHONE;

    if (!ADMIN_PHONE) {
        console.error('WHATSAPP_ADMIN_PHONE not configured');
        return { success: false, error: 'Admin phone not configured' };
    }

    // Template: new_order_alert (needs to be created in Meta dashboard)
    // Variables: {{1}} = Customer Name, {{2}} = Order ID, {{3}} = Total
    return sendWhatsAppMessage(
        ADMIN_PHONE,
        'new_order_alert',
        [customerName, `#${orderId}`, `$${total.toFixed(2)}`]
    )
}

/**
 * Send a simple text message (not a template)
 */
export async function sendWhatsAppText(
    to: string,
    message: string
) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
        console.warn('⚠️ WhatsApp credentials missing. Text message mocked:', { to, message });
        return { success: true, mocked: true };
    }

    try {
        const body = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: {
                body: message,
                preview_url: false
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

/**
 * Send an interactive message with buttons
 */
export async function sendWhatsAppButtons(
    to: string,
    bodyText: string,
    buttons: string[], // Max 3 buttons
    headerText?: string
) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
        console.warn('⚠️ WhatsApp credentials missing. Button message mocked:', { to, bodyText, buttons });
        return { success: true, mocked: true };
    }

    // WhatsApp allows max 3 buttons
    const limitedButtons = buttons.slice(0, 3);

    try {
        const interactiveButtons = limitedButtons.map((btn, idx) => ({
            type: 'reply',
            reply: {
                id: `btn_${idx}`,
                title: btn.substring(0, 20) // Button title max 20 chars
            }
        }));

        const body = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: bodyText
                },
                action: {
                    buttons: interactiveButtons
                }
            }
        };

        // Add header if provided
        if (headerText) {
            (body.interactive as any).header = {
                type: 'text',
                text: headerText
            };
        }

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

