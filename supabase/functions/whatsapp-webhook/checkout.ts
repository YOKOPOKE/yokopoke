
import { SessionData, CheckoutState } from './session.ts';
import { getProductWithSteps } from './productService.ts';
import { BotResponse, ButtonMessage } from './index.ts';
import { supabase } from './productService.ts';
import { createClient } from "npm:@supabase/supabase-js@2";
import { getBusinessHours } from './configService.ts';

// Import send functions
declare function sendButtonMessage(to: string, msg: ButtonMessage): Promise<boolean>;
declare function sendWhatsAppText(to: string, message: string): Promise<void>;

export async function handleCheckoutFlow(
    from: string,
    text: string,
    session: SessionData,
    sendButtonMessageFn?: typeof sendButtonMessage,
    sendTextFn?: typeof sendWhatsAppText
): Promise<BotResponse> {
    if (!session.checkoutState) {
        return { text: "Error: No hay checkout en curso." };
    }

    const checkout = session.checkoutState;
    const lowerText = text.toLowerCase().trim();

    // Step 1: COLLECT_NAME
    if (checkout.checkoutStep === 'COLLECT_NAME') {
        // 👤 PRE-FILL: If we know the customer from history, offer to reuse name
        if (!checkout.customerName && session.customerProfile?.name) {
            // First entry: show the pre-fill suggestion (only once)
            if (!checkout.namePromptShown) {
                checkout.namePromptShown = true;
                return {
                    text: `👤 ¿A nombre de *${session.customerProfile.name}* como siempre?`,
                    useButtons: true,
                    buttons: ['Sí', 'Otro nombre']
                };
            }
            // User responded to the pre-fill prompt
            if (lowerText === 'btn_0' || lowerText === 'sí' || lowerText === 'si' || lowerText === 'yes') {
                // User confirmed the suggested name
                checkout.customerName = session.customerProfile.name;
                checkout.checkoutStep = 'COLLECT_DELIVERY';
                return {
                    text: `✅ Perfecto, *${checkout.customerName}*!\n\n📍 ¿Cómo lo quieres recibir?`,
                    useButtons: true,
                    buttons: ['🏪 Recoger en tienda', '🚗 Envío a domicilio']
                };
            }
            if (lowerText === 'no' || lowerText === 'otro nombre' || lowerText === 'btn_1' || lowerText === 'otro') {
                // User wants a different name — fall through to normal name collection
            } else {
                // User typed a different name directly — accept it
            }
        }

        if (text.length < 2) {
            return {
                text: "⚠️ Por favor escribe un nombre válido (mínimo 2 caracteres)."
            };
        }

        checkout.customerName = text.trim();
        checkout.checkoutStep = 'COLLECT_DELIVERY';

        // Use Button Message instead of old buttons
        if (sendButtonMessageFn) {
            await sendButtonMessageFn(from, {
                body: `✅ Perfecto, *${checkout.customerName}*!\n\n📍 ¿Cómo lo quieres recibir?`,
                buttons: [
                    { id: 'pickup', title: '🏪 Recoger' },
                    { id: 'delivery', title: '🚗 Domicilio' }
                ]
            });
            return { text: "" }; // Already sent
        }

        // Fallback
        return {
            text: `✅ Perfecto, *${checkout.customerName}*!\n\n📍 ¿Cómo lo quieres recibir?`,
            useButtons: true,
            buttons: ['🏪 Recoger en tienda', '🚗 Envío a domicilio']
        };
    }

    // Step 2: COLLECT_DELIVERY
    if (checkout.checkoutStep === 'COLLECT_DELIVERY') {
        let deliveryMethod: 'pickup' | 'delivery';

        // Check for specific IDs OR generic IDs (btn_0/btn_1) OR text content
        if (
            lowerText === 'pickup' ||
            lowerText === 'btn_0' ||
            lowerText.includes('recoger') ||
            lowerText.includes('tienda') ||
            lowerText.includes('pickup')
        ) {
            deliveryMethod = 'pickup';
        } else if (
            lowerText === 'delivery' ||
            lowerText === 'btn_1' ||
            lowerText.includes('envío') ||
            lowerText.includes('envio') ||
            lowerText.includes('domicilio') ||
            lowerText.includes('delivery')
        ) {
            deliveryMethod = 'delivery';
        } else {
            return {
                text: "⚠️ Por favor elige una opción válida:",
                useButtons: true,
                buttons: ['🏪 Recoger en tienda', '🚗 Envío a domicilio']
            };
        }

        checkout.deliveryMethod = deliveryMethod;

        if (deliveryMethod === 'pickup') {
            checkout.checkoutStep = 'SHOW_SUMMARY';
            checkout.pickupTime = 'Lo antes posible'; // Default generic time

            // Send Location Map via BotResponse
            return {
                text: `📍 *Recoger en Tienda*\n\n¡Perfecto! Te esperamos en nuestra sucursal.\n\nConfirma tu pedido para empezar a prepararlo. 👇`,
                useButtons: true,
                buttons: ['Confirmar Pedido', 'Cancelar'],
                location: {
                    lat: 16.2292565,
                    lng: -92.1350074,
                    name: "Yoko Poke House",
                    address: "Calle Belisario Domínguez, Comitán"
                }
            };
        } else {
            // Delivery - Request Location (Premium UX)
            checkout.checkoutStep = 'COLLECT_LOCATION';

            // Get product to show summary
            const product = await getProductWithSteps(checkout.productSlug);
            if (!product) return { text: "Error: Producto no encontrado." };


            return {
                text: `📍 *Envío a Domicilio*\n\nPara ubicarte mejor, ¿puedes compartir tu ubicación?\n\n👉 Toca el botón de adjuntar (+) y selecciona "Ubicación" 📍`
            };
        }
    }



    // Step 2.5: COLLECT_LOCATION (Fallback for text input)
    if (checkout.checkoutStep === 'COLLECT_LOCATION') {
        // If we are here, it means index.ts didn't intercept a 'location' message.
        // Instead, the user sent TEXT. We accept this text as the address.

        // Stricter validation: Length > 8 and must contain spaces (e.g. "Calle 123")
        if (text.length < 8 || !text.includes(' ')) {
            return {
                text: "📍 Para envío a domicilio, por favor comparte tu *Ubicación* de WhatsApp (📎) o escribe tu dirección completa (calle, número, colonia)."
            };
        }

        // Treat text as address
        checkout.fullAddress = text.trim();
        // Zero coords since we don't have GPS
        checkout.location = { latitude: 0, longitude: 0, address: text };
        checkout.checkoutStep = 'COLLECT_REFERENCES';

        return {
            text: `📝 Dirección guardada: ${checkout.fullAddress}\n\n¿Alguna referencia para el repartidor?\n(Ej: "Portón blanco", "Junto al Oxxo")`
        };
    }

    // Step 3: COLLECT_ADDRESS (for delivery after location)
    if (checkout.checkoutStep === 'COLLECT_ADDRESS') {
        if (text.length < 10) {
            return {
                text: "⚠️ Por favor proporciona una dirección completa (calle, número, colonia)."
            };
        }

        checkout.fullAddress = text.trim();
        checkout.checkoutStep = 'COLLECT_REFERENCES';

        return {
            text: `✅ Dirección guardada: ${checkout.fullAddress}\n\n📝 Ahora, ¿alguna referencia para encontrarte?\n(Ej: "Casa azul, portón negro", "Edificio X, Apto 202")`
        };
    }

    // Step 4: COLLECT_REFERENCES (delivery instructions)
    if (checkout.checkoutStep === 'COLLECT_REFERENCES') {
        checkout.addressReferences = text.trim();
        checkout.pickupTime = 'Lo antes posible';
        checkout.checkoutStep = 'SHOW_SUMMARY';

        const product = await getProductWithSteps(checkout.productSlug);
        if (!product) return { text: "Error: Producto no encontrado." };

        const { total, summary } = calculateCheckoutSummary(product, checkout.selections, checkout.totalPrice, session.cart || []);

        const shortAddr = checkout.fullAddress ? checkout.fullAddress.substring(0, 30) + (checkout.fullAddress.length > 30 ? '...' : '') : 'Ubicación compartida';
        const deliveryText = `🚗 Domicilio\n📍 ${shortAddr}`;

        return {
            text: `📋 *RESUMEN DE TU ORDEN*\n\n${summary}\n\n------------------\n👤 *Nombre:* ${checkout.customerName}\n${deliveryText}\n💰 *TOTAL: $${total}*\n------------------\n\n¿Todo correcto?`,
            useButtons: true,
            buttons: ['✅ Sí, Confirmar', '❌ Cambiar algo']
        };
    }



    if (checkout.checkoutStep === 'COLLECT_PICKUP_TIME') {
        const lowerText = text.toLowerCase().trim();
        const cleanId = text.replace('time_', ''); // Handle list ID if prefix used

        // Handle "Ver más horarios"
        if (cleanId === 'show_more_times' || lowerText.includes('ver más') || lowerText.includes('mas tarde')) {
            const slots = await generateTimeSlots(140, 10, 30); // Start 2h 20m from now, 30 min intervals

            return {
                text: "📅 *Horarios Extendidos*\nSelecciona una hora para hoy:",
                useList: true,
                listData: {
                    header: "Horarios Disponibles",
                    body: "Elige la hora que prefieras:",
                    footer: "Yoko Poke",
                    buttonText: "Ver horarios",
                    sections: [{
                        title: "Tarde / Noche",
                        rows: slots.map(s => ({
                            id: `time_${s}`,
                            title: s,
                            description: checkout.deliveryMethod === 'delivery' ? 'Entrega a domicilio' : 'Recoger en tienda'
                        }))
                    }]
                }
            };
        }

        // Validate time selection
        let selectedTime = text.replace(/[🕒✅]/g, '').trim();
        if (selectedTime.startsWith('time_')) selectedTime = selectedTime.replace('time_', '');

        // Validate time: must match time format (e.g. "12:30 p. m." or "1:00 PM")
        const timeRegex = /\d{1,2}:\d{2}/;
        if (selectedTime.length < 3 || !timeRegex.test(selectedTime)) {
            // Not a valid time — re-render time slots
            const shortSlots = await generateTimeSlots(20, 6, 20); // Next 2 hours, 20 min intervals

            if (shortSlots.length === 0) {
                return {
                    text: "🌙 *¡Ya cerramos por hoy!* 🌙\n\nNuestras entregas son hasta las 10:00 PM.\nPor favor intenta de nuevo mañana. ☀️",
                    useButtons: true,
                    buttons: ['Menú Principal']
                };
            }

            return {
                text: `📍 *Recoger en Tienda*\n\n¿A qué hora pasas por tu pedido?`,
                useList: true,
                listData: {
                    header: "Horario de Recogida",
                    body: "Nuestra cocina demora ~20 mins.\nSelecciona una hora estimada:",
                    footer: "Horario Comitán",
                    buttonText: "Seleccionar hora",
                    sections: [
                        {
                            title: "Lo antes posible",
                            rows: shortSlots.map(s => ({
                                id: `time_${s}`,
                                title: s,
                                description: "Sugerido"
                            }))
                        },
                        {
                            title: "Opciones",
                            rows: [{
                                id: "show_more_times",
                                title: "📅 Más tarde",
                                description: "Ver horarios posteriores"
                            }]
                        }
                    ]
                }
            };
        }

        checkout.pickupTime = selectedTime;
        checkout.checkoutStep = 'SHOW_SUMMARY';
        // ... proceed to summary ...

        const product = await getProductWithSteps(checkout.productSlug);
        if (!product) return { text: "Error: Producto no encontrado." };

        const { total, summary } = calculateCheckoutSummary(product, checkout.selections, checkout.totalPrice, session.cart || []);

        let deliveryText = "";
        if (checkout.deliveryMethod === 'delivery') {
            const shortAddr = checkout.fullAddress ? checkout.fullAddress.substring(0, 30) + (checkout.fullAddress.length > 30 ? '...' : '') : 'Ubicación compartida';
            deliveryText = `🚗 Domicilio\n📍 ${shortAddr}`;
        } else {
            deliveryText = `🏪 Recoger en tienda`;
        }

        return {
            text: `📋 *RESUMEN DE TU ORDEN*\n\n${summary}\n\n------------------\n👤 *Nombre:* ${checkout.customerName}\n${deliveryText}\n💰 *TOTAL: $${total}*\n------------------\n\n¿Todo correcto?`,
            useButtons: true,
            buttons: ['✅ Sí, Confirmar', '❌ Cambiar algo']
        };
    }

    // Step 3: SHOW_SUMMARY (Confirmation)
    if (checkout.checkoutStep === 'SHOW_SUMMARY') {
        const lowerText = text.toLowerCase();
        // FIX: Allow natural language exit/restart if user tries to order again
        if (
            lowerText.includes('cancelar') ||
            lowerText.includes('modificar') ||
            lowerText.includes('cambiar') ||
            /\bno\b/.test(lowerText) ||
            lowerText.includes('ver menú') ||
            lowerText.includes('btn_1')
        ) {
            // Reset checkout mode so next message routes normally
            session.mode = 'NORMAL';
            session.checkoutState = undefined;

            return {
                text: "Entendido, no te preocupes. 👌\n\nHe cancelado la orden actual. Cuando quieras, aquí estaré listo para tomar tu pedido de nuevo. 🐼✨\n\n¿Te gustaría ver el menú?",
                useButtons: true,
                buttons: ['Ver Menú']
            };
        }

        // Accept multiple confirmation phrases
        // FIX: Use Regex for strict word matching to avoid "sin", "sinn", etc. identifying as "si"
        const confirmRegex = /\b(confirmar|s[íi]|ok|okay|yes|ya|dale|listo|btn_0)\b/i;
        const isConfirmed = confirmRegex.test(lowerText);

        if (!isConfirmed) {
            return {
                text: "🤔 No entendí tu respuesta. ¿Confirmamos tu pedido?",
                useButtons: true,
                buttons: ['✅ Sí, Confirmar', '❌ Cancelar']
            };
        }

        // 🛡️ IDEMPOTENCY GUARD: Prevent duplicate orders from double-taps
        if (checkout.orderConfirmed) {
            return {
                text: "✅ ¡Tu orden ya fue registrada! Estamos preparándola. 🍣",
                useButtons: true,
                buttons: ['Menú Principal']
            };
        }

        // CREATE ORDER IN DATABASE
        const product = await getProductWithSteps(checkout.productSlug);
        if (!product) {
            return { text: "Error: Producto no encontrado." };
        }

        const { items } = calculateCheckoutSummary(product, checkout.selections, checkout.totalPrice, session.cart || []);

        // --- PRE-ORDER CHECK ---
        const { open } = await getBusinessHours();
        // Use reliable timezone method (same as generateTimeSlots)
        const mxFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Mexico_City',
            hour: '2-digit', hour12: false
        });
        const mxParts = mxFormatter.formatToParts(new Date());
        const currentHour = parseInt(mxParts.find(p => p.type === 'hour')?.value || '0');
        const isPreOrder = currentHour < open;

        const orderData = {
            customer_name: checkout.customerName,
            phone: from,
            total: checkout.totalPrice,
            status: isPreOrder ? 'pre_order' : 'pending', // <--- PRE-ORDER STATUS
            items: items,
            delivery_method: checkout.deliveryMethod || 'pickup',
            pickup_time: checkout.pickupTime || '',
            address: checkout.address || checkout.fullAddress || '', // Fallback
            address_references: checkout.addressReferences || '',
            location: checkout.location || {},
            payment_status: 'pending',
            created_at: new Date().toISOString()
        };

        // 🛡️ Mark as confirmed BEFORE insert to prevent race conditions
        checkout.orderConfirmed = true;
        const { updateSession } = await import('./session.ts');
        await updateSession(from, session);

        // RETRY LOGIC FOR DB INSERT (Hardening)
        let attempt = 0;
        let success = false;
        let insertError = null;

        while (attempt < 2 && !success) {
            const { error } = await supabase.from('orders').insert(orderData);
            if (!error) {
                success = true;
            } else {
                console.error(`Error inserting order (Attempt ${attempt + 1}):`, error);
                insertError = error;
                attempt++;
                if (attempt < 2) await new Promise(r => setTimeout(r, 500)); // Wait 500ms
            }
        }

        if (!success) {
            // Rollback idempotency flag so user can retry
            checkout.orderConfirmed = false;
            await updateSession(from, session);
            return {
                text: "⚠️ Hubo un problema de conexión al guardar tu pedido. Por favor intenta confirmar nuevamente escribiendo *Sí*."
            };
        }

        // --- SAVE TO HISTORY FOR RECOMMENDATIONS (Robustness) ---
        try {
            const { saveOrderToHistory } = await import('./orderHistoryService.ts');

            // Save REAL cart items (not generic product name) for "Lo de siempre"
            const historyItems = (session.cart && session.cart.length > 0)
                ? session.cart.map(i => ({
                    id: String(i.id),
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity
                }))
                : [{
                    id: String(product.slug || product.id),
                    name: product.name,
                    price: checkout.totalPrice,
                    quantity: 1
                }];

            await saveOrderToHistory({
                phone: from,
                customer_name: checkout.customerName,
                items: historyItems,
                total: checkout.totalPrice,
                delivery_method: checkout.deliveryMethod,
                location: checkout.location,
                full_address: checkout.fullAddress,
                address_references: checkout.addressReferences
            });
        } catch (histError) {
            console.error("Non-fatal error saving history:", histError);
        }

        // --- TELEGRAM CRM NOTIFICATION ---
        try {
            const { notifyTelegramNewOrder } = await import('./telegramService.ts');
            await notifyTelegramNewOrder({
                customer_name: checkout.customerName || 'Sin nombre',
                phone: from,
                total: checkout.totalPrice,
                status: orderData.status,
                items: items,
                delivery_method: checkout.deliveryMethod || 'pickup',
                pickup_time: checkout.pickupTime || '',
                address: checkout.fullAddress || checkout.address || '',
                address_references: checkout.addressReferences || '',
            }, session.cart);
        } catch (tgError) {
            console.error("Non-fatal Telegram notification error:", tgError);
        }

        // --- CONFIRMATION MESSAGE ---
        if (isPreOrder) {
            const openTimeStr = `${open > 12 ? open - 12 : open}:00 ${open >= 12 ? 'PM' : 'AM'}`;
            return {
                text: `🔒 *PRE-ORDEN GUARDADA* 🔒\n\nTu pedido ha sido registrado con éxito para el turno de la tarde.\n\n⏰ *A las ${openTimeStr} te enviaremos un mensaje* para confirmar que empezamos a cocinar.\n\n¡Gracias por la espera, ${checkout.customerName}! 🍣⏳`,
                useButtons: true,
                buttons: ['Ver Menú']
            };
        }

        return {
            text: `🎉 *¡ORDEN CONFIRMADA!* 🎉\n\n🧾 EN PREPARACIÓN. ¡Tu orden ha sido confirmada y nuestra cocina ya está trabajando en ella!\n\n¡Gracias por tu preferencia, ${checkout.customerName}! 🥢✨`,
            useButtons: true,
            buttons: ['Menú Principal']
        };
    }

    return { text: "Error en el flujo de checkout." };
}

function calculateCheckoutSummary(product: any, selections: Record<number, number[]>, totalPrice: number, cart: any[] = []) {
    let summary = cart.length > 0 && product.slug === 'custom-order' ? `*Tu Pedido*` : `*${product.name}*`;

    // CUSTOM ORDER (CART CHECKOUT)
    if (product.slug === 'custom-order' && cart.length > 0) {
        let items: any[] = [];
        let recalcTotal = 0;
        summary += "\n";
        cart.forEach(item => {
            const qty = item.quantity || 1;
            summary += `\n• ${qty}x ${item.name} ($${item.price})`;
            recalcTotal += item.price * qty;
            items.push({
                product_id: item.id,
                name: item.name,
                price: item.price,
                quantity: qty,
                type: "product"
            });
        });

        return {
            total: recalcTotal, // Recalculate from actual items, not stale totalPrice
            summary,
            items: items
        };
    }

    // SINGLE PRODUCT CONFIG
    const itemsJson: any = {
        name: product.name,
        productType: product.type || 'bowl',
        base_price: product.base_price
    };

    product.steps.forEach((step: any) => {
        const selectedOptionIds = selections[step.id] || [];
        const selectedOptions = step.options.filter((o: any) => selectedOptionIds.includes(o.id));

        if (selectedOptions.length > 0) {
            summary += `\n\n*${step.label}:*`;
            const optionNames = selectedOptions.map((o: any) => `• ${o.name}`).join('\n');
            summary += `\n${optionNames}`;

            itemsJson[step.name || step.label] = selectedOptions.map((o: any) => o.name);
        }
    });

    return {
        total: totalPrice,
        summary,
        items: [itemsJson]
    };
}

async function generateTimeSlots(startOffsetMinutes = 20, count = 5, interval = 20): Promise<string[]> {
    // Get current time in Mexico City timezone using reliable method
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Mexico_City',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');

    const mxDate = new Date(
        getPart('year'), getPart('month') - 1, getPart('day'),
        getPart('hour'), getPart('minute'), getPart('second')
    );
    const currentHour = mxDate.getHours();

    // Fetch Business Hours
    const { open, close } = await getBusinessHours();

    // Pre-Order Logic: If before Open, start at Open Time
    if (currentHour < open) {
        mxDate.setHours(open, 0, 0, 0);
    } else {
        // Normal Logic: Start from now + offset
        mxDate.setMinutes(mxDate.getMinutes() + startOffsetMinutes);
    }

    // Rounding
    const remainder = mxDate.getMinutes() % interval;
    if (remainder !== 0) {
        mxDate.setMinutes(mxDate.getMinutes() + (interval - remainder));
    }
    mxDate.setSeconds(0);
    mxDate.setMilliseconds(0);

    const slots: string[] = [];
    for (let i = 0; i < count; i++) {
        // Check if exceeds close time
        if (mxDate.getHours() >= close) break;

        const timeStr = mxDate.toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit', hour12: true });
        slots.push(timeStr);
        mxDate.setMinutes(mxDate.getMinutes() + interval);
    }

    return slots;
}
