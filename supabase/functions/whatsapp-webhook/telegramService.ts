/**
 * Telegram Bot CRM Service
 * Sends order notifications to a Telegram group with inline buttons
 * for managing order status directly from Telegram.
 */

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// WhatsApp API for customer notifications
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") ?? "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";

// Customer notification messages by status
const CUSTOMER_MESSAGES: Record<string, string> = {
    confirmed: "✅ *¡Tu pedido fue aceptado!* Pronto empezaremos a prepararlo. 🍣",
    preparing: "🍳 *¡Tu pedido está en preparación!* Nuestra cocina ya está trabajando en él. 🔥",
    on_the_way: "🚗 *¡Tu pedido va en camino!* Pronto llegará a tu puerta. 📍",
    completed: "✔️ *¡Pedido entregado!* ¡Gracias por tu preferencia! Esperamos que lo disfrutes. 🐼❤️",
    cancelled: "❌ *Tu pedido ha sido cancelado.* Si tienes alguna duda, escríbenos. 🙏",
};

// Send WhatsApp text to customer
async function notifyCustomerWhatsApp(phone: string, message: string): Promise<void> {
    if (!WHATSAPP_PHONE_ID || !WHATSAPP_ACCESS_TOKEN || !phone || phone === "test") return;

    try {
        await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phone,
                type: "text",
                text: { body: message },
            }),
        });
        console.log(`📱 WhatsApp notification sent to ${phone}`);
    } catch (e) {
        console.error("WhatsApp notification error:", e);
    }
}

// --- Status Labels ---
const STATUS_LABELS: Record<string, string> = {
    pending: "⏳ Pendiente",
    confirmed: "✅ Aceptado",
    preparing: "🍳 En Preparación",
    on_the_way: "🚗 En Camino",
    completed: "✔️ Entregado",
    cancelled: "❌ Cancelado",
    pre_order: "🔒 Pre-Orden",
};

// --- Core: Send Message ---
async function sendTelegramMessage(
    text: string,
    options?: {
        chatId?: string;
        parseMode?: string;
        replyMarkup?: any;
    }
): Promise<{ ok: boolean; messageId?: number }> {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn("⚠️ Telegram credentials missing. Skipping notification.");
        return { ok: false };
    }

    const chatId = options?.chatId || TELEGRAM_CHAT_ID;

    try {
        const payload: any = {
            chat_id: chatId,
            text: text,
            parse_mode: options?.parseMode || "HTML",
        };

        if (options?.replyMarkup) {
            payload.reply_markup = JSON.stringify(options.replyMarkup);
        }

        const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!data.ok) {
            console.error("❌ Telegram API Error:", data.description);
            return { ok: false };
        }

        return { ok: true, messageId: data.result?.message_id };
    } catch (e) {
        console.error("❌ Telegram Network Error:", e);
        return { ok: false };
    }
}

// --- Core: Edit Message ---
async function editTelegramMessage(
    messageId: number,
    text: string,
    replyMarkup?: any
): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;

    try {
        const payload: any = {
            chat_id: TELEGRAM_CHAT_ID,
            message_id: messageId,
            text: text,
            parse_mode: "HTML",
        };

        if (replyMarkup) {
            payload.reply_markup = JSON.stringify(replyMarkup);
        }

        const res = await fetch(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!data.ok) {
            console.error("❌ Telegram Edit Error:", data.description);
        }
        return data.ok;
    } catch (e) {
        console.error("❌ Telegram Edit Network Error:", e);
        return false;
    }
}

// --- Answer Callback Query (dismiss loading on button press) ---
async function answerCallbackQuery(
    callbackQueryId: string,
    text?: string
): Promise<void> {
    try {
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                callback_query_id: callbackQueryId,
                text: text || "✅ Procesado",
            }),
        });
    } catch (_) {
        // Non-critical
    }
}

// --- Build Inline Keyboard for Order (Progressive Flow) ---
// Only shows the NEXT logical step based on current status
function buildOrderKeyboard(orderPhone: string, currentStatus?: string): any {
    const status = currentStatus || 'pending';

    // Define the flow: pending → confirmed → preparing → on_the_way → completed
    const FLOW: Record<string, { buttons: Array<{ text: string; status: string }> }> = {
        pending: {
            buttons: [
                { text: "✅ Aceptar", status: "confirmed" },
                { text: "❌ Rechazar", status: "cancelled" },
            ],
        },
        pre_order: {
            buttons: [
                { text: "✅ Aceptar", status: "confirmed" },
                { text: "❌ Rechazar", status: "cancelled" },
            ],
        },
        confirmed: {
            buttons: [
                { text: "🍳 Preparando", status: "preparing" },
                { text: "❌ Cancelar", status: "cancelled" },
            ],
        },
        preparing: {
            buttons: [
                { text: "🚗 En Camino", status: "on_the_way" },
                { text: "✔️ Listo (Recoger)", status: "completed" },
                { text: "❌ Cancelar", status: "cancelled" },
            ],
        },
        on_the_way: {
            buttons: [
                { text: "✔️ Entregado", status: "completed" },
                { text: "❌ Cancelar", status: "cancelled" },
            ],
        },
    };

    const step = FLOW[status];
    if (!step) return { inline_keyboard: [] }; // completed/cancelled = no buttons

    const rows = step.buttons.map(btn => [
        { text: btn.text, callback_data: `order:${btn.status}:${orderPhone}` }
    ]);

    return { inline_keyboard: rows };
}

// --- Format Order for Telegram ---
function formatOrderMessage(
    orderData: {
        customer_name: string;
        phone: string;
        total: number;
        status: string;
        items: any[];
        delivery_method?: string;
        pickup_time?: string;
        address?: string;
        address_references?: string;
    },
    cart?: any[]
): string {
    // Timezone-aware timestamp
    const now = new Date();
    const timeStr = now.toLocaleString("es-MX", {
        timeZone: "America/Mexico_City",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });

    // Format items
    let itemsText = "";
    if (cart && cart.length > 0) {
        itemsText = cart
            .map((i) => `  • ${i.quantity || 1}x ${i.name} ($${i.price})`)
            .join("\n");
    } else if (Array.isArray(orderData.items)) {
        itemsText = orderData.items
            .map((i: any) => {
                if (typeof i === "string") return `  • ${i}`;
                return `  • ${i.quantity || 1}x ${i.name || "Producto"} ($${i.price || 0})`;
            })
            .join("\n");
    }

    // Delivery info
    let deliveryText = "";
    if (orderData.delivery_method === "delivery") {
        deliveryText = `🚗 <b>Envío a domicilio</b>`;
        if (orderData.address) deliveryText += `\n📍 ${orderData.address}`;
        if (orderData.address_references) deliveryText += `\n📝 Ref: ${orderData.address_references}`;
    } else {
        deliveryText = `🏪 <b>Recoger en tienda</b>`;
    }
    if (orderData.pickup_time) {
        deliveryText += `\n🕒 ${orderData.pickup_time}`;
    }

    const statusLabel = STATUS_LABELS[orderData.status] || orderData.status;

    return (
        `🆕 <b>NUEVO PEDIDO</b>\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `👤 <b>${orderData.customer_name}</b>\n` +
        `📱 ${orderData.phone}\n` +
        `🕒 ${timeStr}\n\n` +
        `📋 <b>ITEMS:</b>\n${itemsText}\n\n` +
        `${deliveryText}\n\n` +
        `💰 <b>TOTAL: $${orderData.total}</b>\n` +
        `📊 Estado: ${statusLabel}\n` +
        `━━━━━━━━━━━━━━━━`
    );
}

// --- PUBLIC: Notify New Order ---
export async function notifyTelegramNewOrder(
    orderData: {
        customer_name: string;
        phone: string;
        total: number;
        status: string;
        items: any[];
        delivery_method?: string;
        pickup_time?: string;
        address?: string;
        address_references?: string;
    },
    cart?: any[]
): Promise<void> {
    const message = formatOrderMessage(orderData, cart);
    const keyboard = buildOrderKeyboard(orderData.phone);

    const result = await sendTelegramMessage(message, {
        replyMarkup: keyboard,
    });

    if (result.ok) {
        console.log(`📨 Telegram: Order notification sent for ${orderData.phone}`);
    }
}

// --- PUBLIC: Log Conversation to Telegram (Live Feed) ---
export async function logConversationToTelegram(
    phone: string,
    customerName: string | undefined,
    customerMessage: string,
    botResponse: string
): Promise<void> {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

    // Truncate long messages for readability
    const maxLen = 200;
    const custMsg = customerMessage.length > maxLen
        ? customerMessage.substring(0, maxLen) + '...'
        : customerMessage;
    const botMsg = botResponse.length > maxLen
        ? botResponse.substring(0, maxLen) + '...'
        : botResponse;

    // Clean WhatsApp formatting (* for bold) for Telegram
    const cleanBot = botMsg.replace(/\*/g, '');

    const nameLabel = customerName || phone;
    const shortPhone = phone.length > 6 ? '...' + phone.slice(-4) : phone;

    const text =
        `💬 <b>${nameLabel}</b> (${shortPhone})\n` +
        `┣ 👤 ${custMsg}\n` +
        `┗ 🤖 ${cleanBot}`;

    await sendTelegramMessage(text, { parseMode: "HTML" });
}

// --- PUBLIC: Handle Telegram Callback (Button Press) ---
export async function handleTelegramCallback(
    update: any,
    supabase: any
): Promise<Response> {
    const callbackQuery = update.callback_query;
    if (!callbackQuery?.data) {
        return new Response("OK", { status: 200 });
    }

    const callbackData = callbackQuery.data;
    const messageId = callbackQuery.message?.message_id;
    const callbackQueryId = callbackQuery.id;

    // Parse: "order:STATUS:PHONE"
    const parts = callbackData.split(":");
    if (parts.length < 3 || parts[0] !== "order") {
        await answerCallbackQuery(callbackQueryId, "❌ Acción no reconocida");
        return new Response("OK", { status: 200 });
    }

    const newStatus = parts[1];
    const phone = parts.slice(2).join(":"); // Phone might contain colons... unlikely but safe

    // Update order in database (find most recent order for this phone)
    // Bot orders use 'phone' column, web orders use 'customer_phone'
    const { data: order, error } = await supabase
        .from("orders")
        .select("id, customer_name, total, items, delivery_method, pickup_time, status, phone, customer_phone, address, address_references")
        .or(`phone.eq.${phone},customer_phone.eq.${phone}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error || !order) {
        console.error("Telegram Callback: Order not found for phone:", phone, error);
        await answerCallbackQuery(callbackQueryId, "❌ Orden no encontrada");
        return new Response("OK", { status: 200 });
    }

    // Update status
    const { error: updateError } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", order.id);

    if (updateError) {
        console.error("Telegram Callback: Update error:", updateError);
        await answerCallbackQuery(callbackQueryId, "❌ Error al actualizar");
        return new Response("OK", { status: 200 });
    }

    // Edit original Telegram message to reflect new status
    const orderPhone = order.phone || order.customer_phone || phone;
    const updatedOrderData = { ...order, phone: orderPhone, status: newStatus };
    const updatedMessage = formatOrderMessage(updatedOrderData, undefined);

    // If completed or cancelled, remove inline keyboard; otherwise show next step
    const isFinal = newStatus === "completed" || newStatus === "cancelled";
    const updatedKeyboard = isFinal ? { inline_keyboard: [] } : buildOrderKeyboard(phone, newStatus);

    if (messageId) {
        await editTelegramMessage(messageId, updatedMessage, updatedKeyboard);
    }

    // --- NOTIFY CUSTOMER VIA WHATSAPP ---
    const customerMsg = CUSTOMER_MESSAGES[newStatus];
    if (customerMsg && orderPhone) {
        await notifyCustomerWhatsApp(orderPhone, customerMsg);
    }

    const statusLabel = STATUS_LABELS[newStatus] || newStatus;
    await answerCallbackQuery(callbackQueryId, `${statusLabel}`);

    console.log(`📊 Telegram CRM: Order ${order.id} → ${newStatus} (Customer notified: ${!!customerMsg})`);

    return new Response("OK", { status: 200 });
}

// --- PUBLIC: Handle Telegram Commands ---
export async function handleTelegramCommand(
    update: any,
    supabase: any
): Promise<Response> {
    const message = update.message;
    if (!message?.text) return new Response("OK", { status: 200 });

    const text = message.text.trim();
    const chatId = message.chat.id.toString();

    // /pendientes - List pending orders
    if (text === "/pendientes" || text === "/pendientes@YokoPoke_bot") {
        const { data: orders } = await supabase
            .from("orders")
            .select("customer_name, total, status, phone, created_at, delivery_method")
            .in("status", ["pending", "confirmed", "preparing", "on_the_way", "pre_order"])
            .order("created_at", { ascending: false })
            .limit(15);

        if (!orders || orders.length === 0) {
            await sendTelegramMessage("✅ No hay pedidos pendientes.", { chatId });
            return new Response("OK", { status: 200 });
        }

        let response = `📋 <b>PEDIDOS ACTIVOS (${orders.length})</b>\n━━━━━━━━━━━━━━━━\n\n`;
        orders.forEach((o: any, i: number) => {
            const status = STATUS_LABELS[o.status] || o.status;
            const method = o.delivery_method === "delivery" ? "🚗" : "🏪";
            response += `${i + 1}. ${status} ${method}\n   👤 ${o.customer_name} — $${o.total}\n\n`;
        });

        await sendTelegramMessage(response, { chatId });
        return new Response("OK", { status: 200 });
    }

    // /ventas - Today's sales summary
    if (text === "/ventas" || text === "/ventas@YokoPoke_bot") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: orders } = await supabase
            .from("orders")
            .select("total, status")
            .gte("created_at", today.toISOString());

        if (!orders || orders.length === 0) {
            await sendTelegramMessage("📊 No hay pedidos registrados hoy.", { chatId });
            return new Response("OK", { status: 200 });
        }

        const completed = orders.filter((o: any) => o.status === "completed");
        const cancelled = orders.filter((o: any) => o.status === "cancelled");
        const pending = orders.filter((o: any) => !["completed", "cancelled"].includes(o.status));
        const totalSales = completed.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
        const pendingTotal = pending.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);

        const response =
            `📊 <b>VENTAS DEL DÍA</b>\n` +
            `━━━━━━━━━━━━━━━━\n\n` +
            `✅ Completados: <b>${completed.length}</b>\n` +
            `⏳ Activos: <b>${pending.length}</b>\n` +
            `❌ Cancelados: <b>${cancelled.length}</b>\n\n` +
            `💰 Venta completada: <b>$${totalSales}</b>\n` +
            `📦 Venta pendiente: <b>$${pendingTotal}</b>\n` +
            `━━━━━━━━━━━━━━━━`;

        await sendTelegramMessage(response, { chatId });
        return new Response("OK", { status: 200 });
    }

    // /ayuda - Help
    if (text === "/ayuda" || text === "/start" || text === "/help" || text.includes("@YokoPoke_bot")) {
        const help =
            `🐼 <b>Yoko Poke CRM Bot</b>\n\n` +
            `Comandos disponibles:\n` +
            `/pendientes — Ver pedidos activos\n` +
            `/ventas — Resumen de ventas del día\n` +
            `/ayuda — Este mensaje\n\n` +
            `Los pedidos nuevos llegan automáticamente con botones para gestionar su estado.`;

        await sendTelegramMessage(help, { chatId });
        return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });
}
