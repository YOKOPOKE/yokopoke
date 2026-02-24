/**
 * Telegram Bot CRM Service
 * - Order notifications to group with inline buttons
 * - CRM live feed via private bot chat (password protected)
 * - Admin commands (/pendientes, /ventas) in private chat
 */

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? ""; // Group chat
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// WhatsApp API for customer notifications
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") ?? "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";

// Admin password for CRM access
const CRM_PASSWORD = "yokofrank";

// Supabase for persisting admin sessions
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Customer notification messages
const CUSTOMER_MESSAGES: Record<string, string> = {
    confirmed: "✅ *¡Tu pedido fue aceptado!* Pronto empezaremos a prepararlo. 🍣",
    preparing: "🍳 *¡Tu pedido está en preparación!* Nuestra cocina ya está trabajando en él. 🔥",
    on_the_way: "🚗 *¡Tu pedido va en camino!* Pronto llegará a tu puerta. 📍",
    completed: "✔️ *¡Pedido entregado!* ¡Gracias por tu preferencia! Esperamos que lo disfrutes. 🐼❤️",
    cancelled: "❌ *Tu pedido ha sido cancelado.* Si tienes alguna duda, escríbenos. 🙏",
};

// Status labels
const STATUS_LABELS: Record<string, string> = {
    pending: "⏳ Pendiente",
    confirmed: "✅ Aceptado",
    preparing: "🍳 En Preparación",
    on_the_way: "🚗 En Camino",
    completed: "✔️ Entregado",
    cancelled: "❌ Cancelado",
    pre_order: "🔒 Pre-Orden",
};

// ==========================================
// ADMIN AUTH (Persistent via Supabase)
// ==========================================
async function getSupabaseClient(): Promise<any> {
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    return createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function getAuthenticatedAdmins(): Promise<string[]> {
    if (!SUPABASE_URL || !SUPABASE_KEY) return [];
    try {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase
            .from("app_config")
            .select("value")
            .eq("key", "telegram_admins")
            .single();
        if (error) {
            console.log("Admin fetch error (may be first run):", error.message);
            return [];
        }
        return Array.isArray(data?.value) ? data.value : [];
    } catch {
        return [];
    }
}

async function addAuthenticatedAdmin(chatId: string): Promise<void> {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    try {
        const supabase = await getSupabaseClient();
        const admins = await getAuthenticatedAdmins();

        if (admins.includes(chatId)) return; // Already registered
        admins.push(chatId);

        // Try update first, then insert if not exists
        const { data: existing } = await supabase
            .from("app_config")
            .select("key")
            .eq("key", "telegram_admins")
            .single();

        if (existing) {
            const { error } = await supabase
                .from("app_config")
                .update({ value: admins })
                .eq("key", "telegram_admins");
            if (error) console.error("Admin update error:", error);
            else console.log(`✅ Admin ${chatId} saved (update)`);
        } else {
            const { error } = await supabase
                .from("app_config")
                .insert({ key: "telegram_admins", value: admins, description: "Telegram CRM admin chat IDs" });
            if (error) console.error("Admin insert error:", error);
            else console.log(`✅ Admin ${chatId} saved (insert)`);
        }
    } catch (e) {
        console.error("Error saving admin:", e);
    }
}

// ==========================================
// CORE: Send Message
// ==========================================
async function sendTelegramMessage(
    text: string,
    options?: { chatId?: string; parseMode?: string; replyMarkup?: any }
): Promise<{ ok: boolean; messageId?: number }> {
    if (!TELEGRAM_BOT_TOKEN) return { ok: false };

    const chatId = options?.chatId || TELEGRAM_CHAT_ID;
    if (!chatId) return { ok: false };

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
        if (!data.ok) console.error("Telegram API Error:", data.description);
        return { ok: data.ok, messageId: data.result?.message_id };
    } catch (e) {
        console.error("Telegram Network Error:", e);
        return { ok: false };
    }
}

// ==========================================
// CORE: Edit Message
// ==========================================
async function editTelegramMessage(
    chatId: string,
    messageId: number,
    text: string,
    replyMarkup?: any
): Promise<boolean> {
    try {
        const payload: any = {
            chat_id: chatId,
            message_id: messageId,
            text: text,
            parse_mode: "HTML",
        };
        if (replyMarkup) payload.reply_markup = JSON.stringify(replyMarkup);

        const res = await fetch(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        return data.ok;
    } catch {
        return false;
    }
}

// Answer callback query (dismiss loading)
async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    try {
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: callbackQueryId, text: text || "✅" }),
        });
    } catch { /* non-critical */ }
}

// WhatsApp customer notification
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
    } catch (e) {
        console.error("WhatsApp notification error:", e);
    }
}

// ==========================================
// ORDER KEYBOARD (Progressive Flow)
// ==========================================
function buildOrderKeyboard(orderPhone: string, currentStatus?: string): any {
    const status = currentStatus || "pending";

    const FLOW: Record<string, Array<{ text: string; status: string }>> = {
        pending: [
            { text: "✅ Aceptar", status: "confirmed" },
            { text: "❌ Rechazar", status: "cancelled" },
        ],
        pre_order: [
            { text: "✅ Aceptar", status: "confirmed" },
            { text: "❌ Rechazar", status: "cancelled" },
        ],
        confirmed: [
            { text: "🍳 Preparando", status: "preparing" },
            { text: "❌ Cancelar", status: "cancelled" },
        ],
        preparing: [
            { text: "🚗 En Camino", status: "on_the_way" },
            { text: "✔️ Listo (Recoger)", status: "completed" },
            { text: "❌ Cancelar", status: "cancelled" },
        ],
        on_the_way: [
            { text: "✔️ Entregado", status: "completed" },
            { text: "❌ Cancelar", status: "cancelled" },
        ],
    };

    const step = FLOW[status];
    if (!step) return { inline_keyboard: [] };

    // Build rows: action buttons + optional "Ver Dirección" button
    const rows = step.map(btn => [
        { text: btn.text, callback_data: `order:${btn.status}:${orderPhone}` }
    ]);

    return { inline_keyboard: rows };
}

// ==========================================
// FORMAT ORDER MESSAGE (Enhanced)
// ==========================================
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
    cart?: any[],
    isWeb?: boolean
): string {
    const now = new Date();
    const timeStr = now.toLocaleString("es-MX", {
        timeZone: "America/Mexico_City",
        hour: "2-digit", minute: "2-digit", hour12: true,
    });

    // Format items
    let itemsText = "";
    if (cart && cart.length > 0) {
        itemsText = cart.map(i => `  • ${i.quantity || 1}x ${i.name} ($${i.price})`).join("\n");
    } else if (Array.isArray(orderData.items)) {
        itemsText = orderData.items
            .map((i: any) => typeof i === "string" ? `  • ${i}` : `  • ${i.quantity || 1}x ${i.name || "Producto"} ($${i.price || 0})`)
            .join("\n");
    }

    // Delivery info (prominent)
    let deliveryBlock = "";
    if (orderData.delivery_method === "delivery") {
        deliveryBlock = `🚗 <b>ENVÍO A DOMICILIO</b>\n`;
        if (orderData.address) deliveryBlock += `📍 ${orderData.address}\n`;
        if (orderData.address_references) deliveryBlock += `📝 Ref: ${orderData.address_references}\n`;
    } else {
        deliveryBlock = `🏪 <b>RECOGER EN TIENDA</b>\n`;
    }
    if (orderData.pickup_time) {
        deliveryBlock += `🕒 ${orderData.pickup_time}\n`;
    }

    const statusLabel = STATUS_LABELS[orderData.status] || orderData.status;
    const sourceTag = isWeb ? " 🌐" : "";

    return (
        `🆕 <b>NUEVO PEDIDO${sourceTag}</b>\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `👤 <b>${orderData.customer_name}</b>\n` +
        `📱 ${orderData.phone}\n` +
        `🕒 ${timeStr}\n\n` +
        `📋 <b>ITEMS:</b>\n${itemsText}\n\n` +
        `${deliveryBlock}\n` +
        `💰 <b>TOTAL: $${orderData.total}</b>\n` +
        `📊 Estado: ${statusLabel}\n` +
        `━━━━━━━━━━━━━━━━`
    );
}

// ==========================================
// PUBLIC: Notify New Order (Group + Admin Private)
// ==========================================
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
    const keyboard = buildOrderKeyboard(orderData.phone, orderData.status);

    // Add "Ver Dirección" button if delivery
    if (orderData.delivery_method === "delivery" && orderData.address) {
        keyboard.inline_keyboard.push([
            { text: "📍 Ver Dirección", callback_data: `addr:${orderData.phone}` }
        ]);
    }

    // Send to GROUP
    await sendTelegramMessage(message, { replyMarkup: keyboard });

    // Also send to all authenticated PRIVATE admin chats
    const admins = await getAuthenticatedAdmins();
    for (const adminChatId of admins) {
        await sendTelegramMessage(message, { chatId: adminChatId, replyMarkup: keyboard });
    }
}

// ==========================================
// PUBLIC: Log Conversation (Private admin chats only)
// ==========================================
export async function logConversationToTelegram(
    phone: string,
    customerName: string | undefined,
    customerMessage: string,
    botResponse: string
): Promise<void> {
    if (!TELEGRAM_BOT_TOKEN) return;

    const admins = await getAuthenticatedAdmins();
    if (admins.length === 0) return;

    const maxLen = 200;
    const custMsg = customerMessage.length > maxLen ? customerMessage.substring(0, maxLen) + '...' : customerMessage;
    const botMsg = botResponse.length > maxLen ? botResponse.substring(0, maxLen) + '...' : botResponse;
    const cleanBot = botMsg.replace(/\*/g, '');

    const nameLabel = customerName || phone;
    const shortPhone = phone.length > 6 ? '...' + phone.slice(-4) : phone;

    const text =
        `💬 <b>${nameLabel}</b> (${shortPhone})\n` +
        `┣ 👤 ${custMsg}\n` +
        `┗ 🤖 ${cleanBot}`;

    // Only send to authenticated private chats, NOT the group
    for (const adminChatId of admins) {
        await sendTelegramMessage(text, { chatId: adminChatId });
    }
}

// ==========================================
// PUBLIC: Handle Callback (Button Press)
// ==========================================
export async function handleTelegramCallback(
    update: any,
    supabase: any
): Promise<Response> {
    const callbackQuery = update.callback_query;
    if (!callbackQuery?.data) return new Response("OK", { status: 200 });

    const callbackData = callbackQuery.data;
    const messageId = callbackQuery.message?.message_id;
    const callbackQueryId = callbackQuery.id;
    const chatId = callbackQuery.message?.chat?.id?.toString() || TELEGRAM_CHAT_ID;

    // Handle "Ver Dirección" button
    if (callbackData.startsWith("addr:")) {
        const phone = callbackData.substring(5);
        const { data: order } = await supabase
            .from("orders")
            .select("address, address_references, location, customer_name")
            .or(`phone.eq.${phone},customer_phone.eq.${phone}`)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (order) {
            let addrText = `📍 <b>Dirección de ${order.customer_name}</b>\n\n`;
            addrText += order.address ? `🏠 ${order.address}\n` : "Sin dirección registrada\n";
            if (order.address_references) addrText += `📝 Ref: ${order.address_references}\n`;
            if (order.location?.latitude) {
                addrText += `\n🗺️ <a href="https://www.google.com/maps?q=${order.location.latitude},${order.location.longitude}">Abrir en Google Maps</a>`;
            }
            await answerCallbackQuery(callbackQueryId, "📍 Dirección");
            await sendTelegramMessage(addrText, { chatId });
        } else {
            await answerCallbackQuery(callbackQueryId, "❌ No encontrada");
        }
        return new Response("OK", { status: 200 });
    }

    // Parse: "order:STATUS:PHONE"
    const parts = callbackData.split(":");
    if (parts.length < 3 || parts[0] !== "order") {
        await answerCallbackQuery(callbackQueryId, "❌ Acción no reconocida");
        return new Response("OK", { status: 200 });
    }

    const newStatus = parts[1];
    const phone = parts.slice(2).join(":");

    // Find order
    const { data: order, error } = await supabase
        .from("orders")
        .select("id, customer_name, total, items, delivery_method, pickup_time, status, phone, customer_phone, address, address_references")
        .or(`phone.eq.${phone},customer_phone.eq.${phone}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error || !order) {
        await answerCallbackQuery(callbackQueryId, "❌ Orden no encontrada");
        return new Response("OK", { status: 200 });
    }

    // Update status in DB
    const { error: updateError } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", order.id);

    if (updateError) {
        await answerCallbackQuery(callbackQueryId, "❌ Error al actualizar");
        return new Response("OK", { status: 200 });
    }

    // Edit Telegram message
    const orderPhone = order.phone || order.customer_phone || phone;
    const updatedOrderData = { ...order, phone: orderPhone, status: newStatus };
    const updatedMessage = formatOrderMessage(updatedOrderData, undefined);

    const isFinal = newStatus === "completed" || newStatus === "cancelled";
    const updatedKeyboard = isFinal ? { inline_keyboard: [] } : buildOrderKeyboard(phone, newStatus);

    // Add "Ver Dirección" if still active and delivery
    if (!isFinal && order.delivery_method === "delivery" && order.address) {
        updatedKeyboard.inline_keyboard.push([
            { text: "📍 Ver Dirección", callback_data: `addr:${phone}` }
        ]);
    }

    if (messageId) {
        await editTelegramMessage(chatId, messageId, updatedMessage, updatedKeyboard);
    }

    // Notify customer via WhatsApp
    const customerMsg = CUSTOMER_MESSAGES[newStatus];
    if (customerMsg && orderPhone) {
        await notifyCustomerWhatsApp(orderPhone, customerMsg);
    }

    const statusLabel = STATUS_LABELS[newStatus] || newStatus;
    await answerCallbackQuery(callbackQueryId, `${statusLabel}`);
    console.log(`📊 Telegram CRM: Order ${order.id} → ${newStatus}`);

    return new Response("OK", { status: 200 });
}

// ==========================================
// PUBLIC: Handle Commands (Private chat + Auth)
// ==========================================
export async function handleTelegramCommand(
    update: any,
    supabase: any
): Promise<Response> {
    const message = update.message;
    if (!message?.text) return new Response("OK", { status: 200 });

    const text = message.text.trim();
    const chatId = message.chat.id.toString();
    const chatType = message.chat.type; // "private", "group", "supergroup"
    const isPrivate = chatType === "private";

    // --- PASSWORD AUTH (Private chat only) ---
    if (isPrivate && text.toLowerCase() === CRM_PASSWORD) {
        await addAuthenticatedAdmin(chatId);
        await sendTelegramMessage(
            `🔐 <b>¡Acceso CRM Activado!</b>\n\n` +
            `Ahora recibirás:\n` +
            `• 📦 Notificaciones de pedidos nuevos\n` +
            `• 💬 Mensajes del bot en tiempo real\n\n` +
            `Comandos disponibles:\n` +
            `/pendientes — Pedidos activos\n` +
            `/ventas — Ventas del día\n` +
            `/ayuda — Ayuda`,
            { chatId }
        );
        return new Response("OK", { status: 200 });
    }

    // For commands: check if user is authenticated (private) or if it's the group
    const isGroup = chatType === "group" || chatType === "supergroup";
    if (isPrivate) {
        const admins = await getAuthenticatedAdmins();
        if (!admins.includes(chatId)) {
            // Not authenticated — ask for password
            await sendTelegramMessage(
                `🔒 <b>Acceso Restringido</b>\n\nEscribe la contraseña para acceder al CRM.`,
                { chatId }
            );
            return new Response("OK", { status: 200 });
        }
    }

    // /start
    if (text === "/start" || text === "/start@YokoPoke_bot") {
        if (isPrivate) {
            await sendTelegramMessage(
                `🐼 <b>Yoko Poke CRM Bot</b>\n\n🔒 Escribe la contraseña para acceder al panel de control.`,
                { chatId }
            );
        }
        return new Response("OK", { status: 200 });
    }

    // /pendientes
    if (text === "/pendientes" || text === "/pendientes@YokoPoke_bot") {
        const { data: orders } = await supabase
            .from("orders")
            .select("customer_name, total, status, phone, customer_phone, delivery_method, address, pickup_time")
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
            const method = o.delivery_method === "delivery" ? "🚗 Domicilio" : "🏪 Recoger";
            const addr = o.delivery_method === "delivery" && o.address ? `\n   📍 ${o.address.substring(0, 40)}` : "";
            const time = o.pickup_time ? `\n   🕒 ${o.pickup_time}` : "";
            response += `${i + 1}. ${status}\n   👤 ${o.customer_name} — $${o.total}\n   ${method}${addr}${time}\n\n`;
        });

        await sendTelegramMessage(response, { chatId });
        return new Response("OK", { status: 200 });
    }

    // /ventas
    if (text === "/ventas" || text === "/ventas@YokoPoke_bot") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: orders } = await supabase
            .from("orders")
            .select("total, status, delivery_method")
            .gte("created_at", today.toISOString());

        if (!orders || orders.length === 0) {
            await sendTelegramMessage("📊 No hay pedidos registrados hoy.", { chatId });
            return new Response("OK", { status: 200 });
        }

        const completed = orders.filter((o: any) => o.status === "completed");
        const cancelled = orders.filter((o: any) => o.status === "cancelled");
        const pending = orders.filter((o: any) => !["completed", "cancelled"].includes(o.status));
        const deliveries = orders.filter((o: any) => o.delivery_method === "delivery");
        const pickups = orders.filter((o: any) => o.delivery_method !== "delivery");
        const totalSales = completed.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
        const pendingTotal = pending.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);

        const response =
            `📊 <b>VENTAS DEL DÍA</b>\n` +
            `━━━━━━━━━━━━━━━━\n\n` +
            `✅ Completados: <b>${completed.length}</b>\n` +
            `⏳ Activos: <b>${pending.length}</b>\n` +
            `❌ Cancelados: <b>${cancelled.length}</b>\n\n` +
            `� A domicilio: <b>${deliveries.length}</b>\n` +
            `🏪 Recoger: <b>${pickups.length}</b>\n\n` +
            `�💰 Venta completada: <b>$${totalSales}</b>\n` +
            `📦 Venta pendiente: <b>$${pendingTotal}</b>\n` +
            `━━━━━━━━━━━━━━━━`;

        await sendTelegramMessage(response, { chatId });
        return new Response("OK", { status: 200 });
    }

    // /pausar PHONE - Pause bot for a customer (human takes over)
    if (text.startsWith("/pausar")) {
        const phonePart = text.replace("/pausar@YokoPoke_bot", "").replace("/pausar", "").trim();
        if (!phonePart) {
            await sendTelegramMessage(
                `⏸️ <b>Pausar Bot</b>\n\nUso: /pausar [teléfono]\nEj: /pausar 9631234567\n\nEl bot dejará de responder a ese cliente por 1 hora.`,
                { chatId }
            );
            return new Response("OK", { status: 200 });
        }

        // Find the session
        const { data: sessionData } = await supabase
            .from("whatsapp_sessions")
            .select("phone, state")
            .ilike("phone", `%${phonePart}%`)
            .limit(1)
            .single();

        if (!sessionData) {
            await sendTelegramMessage(`❌ No se encontró sesión para: ${phonePart}`, { chatId });
            return new Response("OK", { status: 200 });
        }

        const state = sessionData.state as any;
        state.mode = 'PAUSED';
        state.pausedUntil = Date.now() + (3600 * 1000); // 1 hour

        await supabase
            .from("whatsapp_sessions")
            .update({ state, updated_at: new Date().toISOString() })
            .eq("phone", sessionData.phone);

        await sendTelegramMessage(
            `⏸️ <b>Bot pausado</b> para ${sessionData.phone}\n\n` +
            `El bot no responderá por 1 hora.\n` +
            `Usa /mensaje para escribirle directamente.\n` +
            `Usa /reanudar ${phonePart} para reactivar.`,
            { chatId }
        );
        return new Response("OK", { status: 200 });
    }

    // /reanudar PHONE - Resume bot for a customer
    if (text.startsWith("/reanudar")) {
        const phonePart = text.replace("/reanudar@YokoPoke_bot", "").replace("/reanudar", "").trim();
        if (!phonePart) {
            await sendTelegramMessage(`▶️ <b>Reanudar Bot</b>\n\nUso: /reanudar [teléfono]`, { chatId });
            return new Response("OK", { status: 200 });
        }

        const { data: sessionData } = await supabase
            .from("whatsapp_sessions")
            .select("phone, state")
            .ilike("phone", `%${phonePart}%`)
            .limit(1)
            .single();

        if (!sessionData) {
            await sendTelegramMessage(`❌ No se encontró sesión para: ${phonePart}`, { chatId });
            return new Response("OK", { status: 200 });
        }

        const state = sessionData.state as any;
        state.mode = 'NORMAL';
        state.pausedUntil = undefined;

        await supabase
            .from("whatsapp_sessions")
            .update({ state, updated_at: new Date().toISOString() })
            .eq("phone", sessionData.phone);

        await sendTelegramMessage(`▶️ <b>Bot reactivado</b> para ${sessionData.phone}`, { chatId });
        return new Response("OK", { status: 200 });
    }

    // /mensaje PHONE TEXT - Send WhatsApp to customer from Telegram
    if (text.startsWith("/mensaje")) {
        const args = text.replace("/mensaje@YokoPoke_bot", "").replace("/mensaje", "").trim();
        const spaceIdx = args.indexOf(" ");

        if (!args || spaceIdx === -1) {
            await sendTelegramMessage(
                `📨 <b>Enviar WhatsApp</b>\n\nUso: /mensaje [teléfono] [texto]\nEj: /mensaje 9631234567 ¡Tu pedido está listo!`,
                { chatId }
            );
            return new Response("OK", { status: 200 });
        }

        const targetPhone = args.substring(0, spaceIdx).trim();
        const msgText = args.substring(spaceIdx + 1).trim();

        if (!msgText) {
            await sendTelegramMessage(`❌ Falta el mensaje. Ej: /mensaje ${targetPhone} Hola!`, { chatId });
            return new Response("OK", { status: 200 });
        }

        // Format phone (add 52 if needed)
        let phone = targetPhone.replace(/\D/g, '');
        if (phone.length === 10) phone = '52' + phone;

        await notifyCustomerWhatsApp(phone, msgText);
        await sendTelegramMessage(
            `✅ <b>WhatsApp enviado</b>\n📱 ${phone}\n💬 ${msgText}`,
            { chatId }
        );
        return new Response("OK", { status: 200 });
    }

    // /cerrar - Close store manually
    if (text === "/cerrar" || text === "/cerrar@YokoPoke_bot") {
        const supabaseAdmin = await getSupabaseClient();
        // Set business hours to 0-0 (always closed)
        const { data: existing } = await supabaseAdmin
            .from("app_config")
            .select("key, value")
            .eq("key", "business_hours")
            .single();

        // Save original hours before overriding
        if (existing?.value) {
            await supabaseAdmin
                .from("app_config")
                .upsert({ key: "business_hours_backup", value: existing.value }, { onConflict: "key" });
        }

        await supabaseAdmin
            .from("app_config")
            .upsert({ key: "business_hours", value: { open: 0, close: 0 } }, { onConflict: "key" });

        await sendTelegramMessage(
            `🔴 <b>TIENDA CERRADA</b>\n\n` +
            `El bot informará a los clientes que la tienda está cerrada.\n` +
            `Usa /abrir para reabrir.`,
            { chatId }
        );
        return new Response("OK", { status: 200 });
    }

    // /abrir - Open store manually
    if (text === "/abrir" || text === "/abrir@YokoPoke_bot") {
        const supabaseAdmin = await getSupabaseClient();

        // Restore original hours
        const { data: backup } = await supabaseAdmin
            .from("app_config")
            .select("value")
            .eq("key", "business_hours_backup")
            .single();

        const hours = backup?.value || { open: 14, close: 22 };

        await supabaseAdmin
            .from("app_config")
            .upsert({ key: "business_hours", value: hours }, { onConflict: "key" });

        await sendTelegramMessage(
            `🟢 <b>TIENDA ABIERTA</b>\n\n` +
            `Horario: ${hours.open}:00 - ${hours.close}:00\n` +
            `El bot ya acepta pedidos.`,
            { chatId }
        );
        return new Response("OK", { status: 200 });
    }


    if (text === "/actividad" || text === "/actividad@YokoPoke_bot") {
        await sendTelegramMessage("⏳ Cargando actividad reciente...", { chatId });

        const { data: sessions } = await supabase
            .from("whatsapp_sessions")
            .select("phone, state, updated_at")
            .order("updated_at", { ascending: false })
            .limit(6);

        if (!sessions || sessions.length === 0) {
            await sendTelegramMessage("📭 No hay conversaciones recientes.", { chatId });
            return new Response("OK", { status: 200 });
        }

        let hasContent = false;
        for (const session of sessions) {
            const state = session.state as any;
            const history = state?.conversationHistory;
            if (!history || history.length === 0) continue;
            hasContent = true;

            const customerName = state?.customerProfile?.name
                || state?.checkoutState?.customerName
                || "Cliente";
            const shortPhone = session.phone.length > 6 ? '...' + session.phone.slice(-4) : session.phone;
            const mode = state?.mode || 'NORMAL';
            const modeIcon = mode === 'CHECKOUT' ? '🛒' : mode === 'BUILDER' ? '🔨' : mode === 'PAUSED' ? '⏸️' : '💬';

            // Time ago
            const updatedAt = new Date(session.updated_at);
            const minsAgo = Math.round((Date.now() - updatedAt.getTime()) / 60000);
            const timeAgo = minsAgo < 1 ? "ahora" : minsAgo < 60 ? `hace ${minsAgo}m` : `hace ${Math.round(minsAgo / 60)}h`;

            let chatText = `╔══════════════════\n`;
            chatText += `║ ${modeIcon} <b>${customerName}</b> (${shortPhone})\n`;
            chatText += `║ ⏰ ${timeAgo}\n`;
            chatText += `╠══════════════════\n`;

            const recentMsgs = history.slice(-6);
            for (const msg of recentMsgs) {
                const icon = msg.role === 'user' ? '👤' : '🤖';
                const maxLen = msg.role === 'user' ? 100 : 150;
                let txt = msg.text.replace(/\*/g, '').replace(/\n/g, ' ');
                if (txt.length > maxLen) txt = txt.substring(0, maxLen) + '...';
                chatText += `║ ${icon} ${txt}\n`;
            }
            chatText += `╚══════════════════`;

            await sendTelegramMessage(chatText, { chatId });
        }

        if (!hasContent) {
            await sendTelegramMessage("📭 No hay conversaciones con historial.", { chatId });
        }
        return new Response("OK", { status: 200 });
    }

    // /cliente PHONE - Search specific customer
    if (text.startsWith("/cliente")) {
        const phonePart = text.replace("/cliente@YokoPoke_bot", "").replace("/cliente", "").trim();

        if (!phonePart) {
            await sendTelegramMessage(
                `🔍 <b>Buscar Cliente</b>\n\nUso: /cliente [teléfono]\nEj: /cliente 9631234567`,
                { chatId }
            );
            return new Response("OK", { status: 200 });
        }

        const { data: orders } = await supabase
            .from("orders")
            .select("id, customer_name, total, status, delivery_method, address, pickup_time, created_at, phone, customer_phone")
            .or(`phone.ilike.%${phonePart}%,customer_phone.ilike.%${phonePart}%`)
            .order("created_at", { ascending: false })
            .limit(5);

        const { data: sessionData } = await supabase
            .from("whatsapp_sessions")
            .select("phone, state, updated_at")
            .ilike("phone", `%${phonePart}%`)
            .limit(1)
            .single();

        if ((!orders || orders.length === 0) && !sessionData) {
            await sendTelegramMessage(`❌ No se encontró cliente con: ${phonePart}`, { chatId });
            return new Response("OK", { status: 200 });
        }

        let msg = `🔍 <b>CLIENTE: ${phonePart}</b>\n━━━━━━━━━━━━━━━━\n\n`;

        if (sessionData) {
            const state = sessionData.state as any;
            const profile = state?.customerProfile;
            if (profile) {
                msg += `👤 <b>${profile.name || "Sin nombre"}</b>\n`;
                if (profile.orderCount) msg += `📦 Pedidos totales: ${profile.orderCount}\n`;
                if (profile.favorites?.length) msg += `⭐ Favoritos: ${profile.favorites.join(", ")}\n`;
                if (profile.lastAddress) msg += `📍 Última dir: ${profile.lastAddress}\n`;
                msg += `\n`;
            }

            const history = state?.conversationHistory;
            if (history && history.length > 0) {
                msg += `💬 <b>Último chat:</b>\n`;
                for (const m of history.slice(-4)) {
                    const icon = m.role === 'user' ? '👤' : '🤖';
                    let txt = m.text.replace(/\*/g, '').replace(/\n/g, ' ');
                    if (txt.length > 100) txt = txt.substring(0, 100) + '...';
                    msg += `  ${icon} ${txt}\n`;
                }
                msg += `\n`;
            }
        }

        if (orders && orders.length > 0) {
            msg += `📋 <b>Últimos pedidos:</b>\n`;
            for (const o of orders) {
                const status = STATUS_LABELS[o.status] || o.status;
                const date = new Date(o.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
                const method = o.delivery_method === "delivery" ? "🚗" : "🏪";
                msg += `  ${status} ${method} $${o.total} — ${date}\n`;
            }
        }

        msg += `━━━━━━━━━━━━━━━━`;
        await sendTelegramMessage(msg, { chatId });
        return new Response("OK", { status: 200 });
    }

    // /ayuda
    if (text === "/ayuda" || text === "/help" || text === "/ayuda@YokoPoke_bot") {
        await sendTelegramMessage(
            `🐼 <b>Yoko Poke CRM Bot</b>\n\n` +
            `<b>📊 Panel:</b>\n` +
            `/actividad — Chats recientes del bot\n` +
            `/pendientes — Pedidos activos\n` +
            `/ventas — Ventas del día\n\n` +
            `<b>🔍 Búsqueda:</b>\n` +
            `/cliente [tel] — Buscar cliente\n\n` +
            `<b>💬 Comunicación:</b>\n` +
            `/mensaje [tel] [texto] — Enviar WhatsApp\n` +
            `/pausar [tel] — Pausar bot (modo humano)\n` +
            `/reanudar [tel] — Reactivar bot\n\n` +
            `<b>🏪 Tienda:</b>\n` +
            `/cerrar — Cerrar tienda\n` +
            `/abrir — Abrir tienda\n\n` +
            `/ayuda — Este mensaje`,
            { chatId }
        );
        return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });
}
