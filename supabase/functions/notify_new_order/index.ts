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

        const order = payload.record;
        const oldRecord = payload.old_record;

        if (!order || !oldRecord) {
            return new Response("Update requires old and new record", { status: 200 });
        }

        // 🧠 STATUS CHANGE LOGIC (Robust) 🧠

        const oldStatus = oldRecord.status;
        const newStatus = order.status;

        // SKIP if status didn't change
        if (oldStatus === newStatus) {
            return new Response("No status change", { status: 200 });
        }

        let message = "";

        // Logic based purely on newStatus to be robust against skipped steps or missing columns
        switch (newStatus) {
            case 'preparing': // pending -> preparing
                message = "👨‍🍳 *EN PREPARACIÓN:* Su orden ha sido confirmada y nuestra cocina ha comenzado a prepararla.";
                break;
            case 'out_for_delivery': // preparing -> out_for_delivery
                if (order.delivery_method === 'pickup') {
                    message = "📦 *LISTO PARA RECOGER:* Tu pedido ya está empaquetado y listo en sucursal. ¡Te esperamos! 🍱✨";
                } else {
                    message = "🚀 *EN CAMINO:* Su pedido ha salido del restaurante y va rumbo a su domicilio. ¡Le sugerimos estar atento!";
                }
                break;
            case 'completed': // -> completed
                if (order.delivery_method === 'pickup') {
                    message = "✅ *ENTREGADO:* ¡Gracias por visitarnos! Esperamos que disfrutes tu Yoko Poke. 🐼";
                } else {
                    message = "✅ *ENTREGADO:* Su pedido ha sido entregado. ¡Buen provecho! 🥢";
                }
                break;
            case 'cancelled':
                message = "❌ *CANCELADO:* Su pedido ha sido cancelado. Si tiene dudas, contacte a soporte.";
                break;
        }

        if (!message) {
            console.log(`ℹ️ Status change ${oldStatus}->${newStatus} not relevant for notification.`);
            return new Response("Skipped: Irrelevant Status change", { status: 200 });
        }

        const orderId = order.id;

        // Format Phone: Robust check for 'phone' column (as defined in create_orders_tables.sql)
        // Fallback to customer_phone if schema changes in future
        let rawPhone = order.phone || order.customer_phone || '';
        let phone = String(rawPhone).replace(/\D/g, '');

        // If from whatsapp it might have 52...
        // Ensure it has 52 if 10 digits (Mexico specific helper)
        if (phone.length === 10) phone = '52' + phone;

        console.log(`Sending WhatsApp to Customer (${phone}) for Order #${orderId} - Status: ${newStatus}`);

        if (phone.length < 10) {
            console.error("Invalid phone number, skipping WhatsApp");
            return new Response("Invalid Phone", { status: 400 });
        }

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
                    to: phone,
                    type: "template",
                    template: {
                        name: "actualizacion_pedido1",
                        language: { code: "es_MX" },
                        components: [
                            {
                                type: "body",
                                parameters: [
                                    { type: "text", text: String(orderId) }, // {{1}}
                                    { type: "text", text: "Yoko Poke House" }, // {{2}}
                                    { type: "text", text: message } // {{3}}
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
