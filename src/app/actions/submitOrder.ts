"use server";

import { createClient } from "@/lib/supabase";
import { OrderItem } from "@/context/CartContext";

interface OrderFormData {
    name: string;
    phone: string;
    address?: string;
    instructions?: string;
    paymentMethod?: 'cash' | 'card';
}

export async function submitOrder(formData: OrderFormData, items: OrderItem[], total: number) {
    const supabase = createClient();

    // Input validation
    if (!formData.name || formData.name.trim().length < 2) {
        return { success: false, error: "Nombre inválido (mínimo 2 caracteres)." };
    }
    if (!formData.phone || formData.phone.trim().length < 10) {
        return { success: false, error: "Teléfono inválido (mínimo 10 dígitos)." };
    }
    if (!items || items.length === 0) {
        return { success: false, error: "El pedido debe contener al menos un producto." };
    }

    // Server-side price validation: recalculate total from items
    const serverTotal = items.reduce((sum, item) => {
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 1;
        if (price <= 0 || price > 10000) return sum; // Reject unreasonable prices
        return sum + (price * quantity);
    }, 0);

    // Reject if client total differs significantly from server calculation
    // Allow small rounding differences (up to $1)
    if (Math.abs(serverTotal - total) > 1) {
        console.error(`Price mismatch detected! Client: $${total}, Server: $${serverTotal}`);
        return { success: false, error: "Error de validación de precio. Intenta de nuevo." };
    }

    const paymentMethod = formData.paymentMethod || 'cash';
    const initialStatus = paymentMethod === 'card' ? 'awaiting_payment' : 'pending';
    const initialPaymentStatus = paymentMethod === 'card' ? 'unpaid' : 'pending_cash';

    const { data: order, error } = await supabase.from('orders').insert({
        customer_name: formData.name.trim(),
        customer_phone: formData.phone.trim(),
        customer_address: formData.address?.trim() || '',
        total: serverTotal, // Use server-validated total
        status: initialStatus,
        payment_status: initialPaymentStatus,
        payment_method: paymentMethod,
        items: items,
        notes: formData.instructions?.trim() || ''
    }).select().single();

    if (error) {
        console.error("Order Insert Error:", error);
        return { success: false, error: "Error al crear el pedido. Intenta de nuevo." };
    }

    // --- TELEGRAM CRM NOTIFICATION ---
    try {
        const tgToken = process.env.TELEGRAM_BOT_TOKEN;
        const tgChatId = process.env.TELEGRAM_CHAT_ID;
        if (tgToken && tgChatId) {
            const phone = formData.phone.trim();
            const itemsText = items
                .map((i: any) => `  • ${i.quantity || 1}x ${i.name || 'Producto'} ($${i.price || 0})`)
                .join('\n');

            const timeStr = new Date().toLocaleString("es-MX", {
                timeZone: "America/Mexico_City",
                hour: "2-digit", minute: "2-digit", hour12: true,
            });

            const message =
                `🆕 <b>PEDIDO WEB</b> 🌐\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `👤 <b>${formData.name.trim()}</b>\n` +
                `📱 ${phone}\n` +
                `🕒 ${timeStr}\n\n` +
                `📋 <b>ITEMS:</b>\n${itemsText}\n\n` +
                `${formData.address ? `📍 ${formData.address}\n` : ''}` +
                `💰 <b>TOTAL: $${serverTotal}</b>\n` +
                `📊 Estado: ⏳ Pendiente\n` +
                `━━━━━━━━━━━━━━━━`;

            const keyboard = {
                inline_keyboard: [
                    [
                        { text: "✅ Aceptar", callback_data: `order:confirmed:${phone}` },
                        { text: "🍳 Preparando", callback_data: `order:preparing:${phone}` },
                    ],
                    [
                        { text: "🚗 En Camino", callback_data: `order:on_the_way:${phone}` },
                        { text: "✔️ Entregado", callback_data: `order:completed:${phone}` },
                    ],
                    [{ text: "❌ Cancelar", callback_data: `order:cancelled:${phone}` }],
                ],
            };

            await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: tgChatId,
                    text: message,
                    parse_mode: "HTML",
                    reply_markup: JSON.stringify(keyboard),
                }),
            });
        }
    } catch (tgError) {
        console.error("Non-fatal Telegram notification error:", tgError);
    }

    return { success: true, orderId: order.id };
}
