// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This code is meant to be pasted into a Supabase Edge Function (e.g. 'notify_new_order')

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID")!;
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;

serve(async (req) => {
    try {
        const payload = await req.json();
        console.log("🦋 Webhook Payload received:", payload);

        // Supabase Database Webhooks send the record in 'record'
        const order = payload.record;

        if (!order) {
            return new Response("No record found", { status: 400 });
        }

        const customerName = order.customer_name;
        const orderId = order.id;
        const total = order.total;
        const adminPhone = "529631371902"; // Hardcoded or env var

        console.log(`Sending WhatsApp to Admin (${adminPhone}) for Order #${orderId}`);

        const response = await fetch(
            `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: adminPhone,
                    type: "template",
                    template: {
                        name: "new_order_alert", // Ensure this template exists in Meta
                        language: { code: "es_MX" },
                        components: [
                            {
                                type: "body",
                                parameters: [
                                    // Combine Name + Phone because our template only has 3 variables
                                    // Variable 1 is "Customer Name"
                                    { type: "text", text: `${customerName} (${order.customer_phone || 'Sin num'})` },
                                    { type: "text", text: `#${orderId.slice(0, 8)}` },
                                    { type: "text", text: `$${total}` },
                                ],
                            },
                        ],
                    },
                }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("❌ Meta API Error:", data);
            return new Response(JSON.stringify(data), { status: 400 });
        }

        console.log("✅ Message sent successfully:", data);
        return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("❌ Internal Function Error:", error);
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), { status: 500 });
    }
});
