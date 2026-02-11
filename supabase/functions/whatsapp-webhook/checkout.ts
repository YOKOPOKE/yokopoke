
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
                body: `✅ Perfecto, * ${checkout.customerName}* !\n\n📍 ¿Cómo lo quieres recibir ? `,
                buttons: [
                    { id: 'pickup', title: '🏪 Recoger' },
                    { id: 'delivery', title: '🚗 Domicilio' }
                ]
            });
            return { text: "" }; // Already sent
        }

        // Fallback
        return {
            text: `✅ Perfecto, * ${checkout.customerName}* !\n\n📍 ¿Cómo lo quieres recibir ? `,
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
        checkout.deliveryMethod = deliveryMethod;

        if (deliveryMethod === 'pickup') {
            checkout.checkoutStep = 'COLLECT_PICKUP_TIME';

            const slots = generateTimeSlots();
            const buttons = slots.slice(0, 3).map(s => `🕒 ${s} `); // Max 3 buttons

            // If more than 3 slots, maybe just show 3 for now or list body
            const slotsText = slots.map(s => `• ${s} `).join('\n');

            return {
                text: `📍 * Recoger en Tienda *\n\n¿A qué hora pasas por tu pedido ? (Estimado) \n\n${slotsText} \n\nSelecciona una hora 👇`,
                useButtons: true,
                buttons: slots.slice(0, 3)
            };
        } else {
            // Delivery - Request Location (Premium UX)
            checkout.checkoutStep = 'COLLECT_LOCATION';

            // Get product to show summary
            const product = await getProductWithSteps(checkout.productSlug);
            if (!product) return { text: "Error: Producto no encontrado." };


            return {
                text: `📍 * Envío a Domicilio *\n\nPara ubicarte mejor, ¿puedes compartir tu ubicación ?\n\n👉 Toca el botón de adjuntar(+) y selecciona "Ubicación" 📍`
            };
        }
    }

    // Helper to get Mexico City time
    function getMexicoCityTime() {
        return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
    }

    function generateTimeSlots(startOffsetMinutes = 20, limit = 6, interval = 20): string[] {
        let mxDate = getMexicoCityTime();

        // Start offset mins from now (Prep time)
        mxDate.setMinutes(mxDate.getMinutes() + startOffsetMinutes);

        // Round up to next interval
        const remainder = mxDate.getMinutes() % interval;
        if (remainder !== 0) {
            mxDate.setMinutes(mxDate.getMinutes() + (interval - remainder));
        }
        mxDate.setSeconds(0);
        mxDate.setMilliseconds(0);

        // Business Hours: 2 PM (14:00) - 10 PM (22:00)
        const openingTime = getMexicoCityTime();
        openingTime.setHours(14, 0, 0, 0); // Open at 2 PM

        const closingTime = getMexicoCityTime();
        closingTime.setHours(22, 0, 0, 0); // Close at 10 PM

        // If calculated start is before opening, jump to opening time
        if (mxDate < openingTime) {
            mxDate = new Date(openingTime);
        }

        const slots: string[] = [];

        for (let i = 0; i < limit; i++) {
            // Strict Check: Cannot be past closing time
            if (mxDate > closingTime) break;

            // Format: HH:MM AM/PM
            const timeStr = mxDate.toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit', hour12: true });
            slots.push(timeStr);
            mxDate.setMinutes(mxDate.getMinutes() + interval);
        }
        return slots;
    }

    // Step 2.5: COLLECT_LOCATION (Fallback for text input)
    if (checkout.checkoutStep === 'COLLECT_LOCATION') {
        // If we are here, it means index.ts didn't intercept a 'location' message.
        // Instead, the user sent TEXT. We accept this text as the address.

        if (text.length < 5) {
            return {
                text: "📍 Para envío a domicilio, por favor comparte tu *Ubicación* de WhatsApp (📎) o escribe tu dirección completa."
            };
        }

        // Treat text as address
        checkout.fullAddress = text.trim();
        // Zero coords since we don't have GPS
        checkout.location = { latitude: 0, longitude: 0, address: text };
        checkout.checkoutStep = 'COLLECT_REFERENCES';

        return {
            text: `📝 Dirección guardada: ${checkout.fullAddress} \n\n¿Alguna referencia para el repartidor ?\n(Ej: "Portón blanco", "Junto al Oxxo")`
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
            text: `✅ Dirección guardada: ${checkout.fullAddress} \n\n📝 Ahora, ¿alguna referencia para encontrarte ?\n(Ej: "Casa azul, portón negro", "Edificio X, Apto 202")`
        };
    }

    // Step 4: COLLECT_REFERENCES (delivery instructions)
    if (checkout.checkoutStep === 'COLLECT_REFERENCES') {
        checkout.addressReferences = text.trim();
        checkout.checkoutStep = 'COLLECT_PICKUP_TIME'; // Reuse time slot for delivery ETA

        const slots = await generateTimeSlots();
        return {
            text: `✅ Referencias guardadas.\n\n🕒 ¿A qué hora te gustaría recibir tu pedido ?\n\n${slots.map(s => `• ${s}`).join('\n')} \n\nSelecciona una hora 👇`,
            useButtons: true,
            buttons: slots.slice(0, 3)
        };
    }

    // ... inside processCheckoutStep ...

    // Step 2.5: COLLECT_PICKUP_TIME
    // Handling INITIAL Request
    if (checkout.deliveryMethod === 'pickup' && checkout.checkoutStep === 'COLLECT_PICKUP_TIME' && !text) {
        // This block handles the "entry" into this state if called recursively, 
        // but usually we set state and return immediately in previous step.
        // We'll rely on the "previous step" logic to render this.
        // WAITING FOR INPUT...
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
                            id: `time_${s} `,
                            title: s,
                            description: "Recoger en tienda"
                        }))
                    }]
                }
            };
        }

        // Validate time selection
        let selectedTime = text.replace(/[🕒✅]/g, '').trim();
        if (selectedTime.startsWith('time_')) selectedTime = selectedTime.replace('time_', '');

        // Basic validation: must look like time or be in list
        // We accept it if logic flow got here

        if (selectedTime.length < 3) {
            // Re-render INITIAL view
            const shortSlots = await generateTimeSlots(20, 6, 20); // Next 2 hours, 20 min intervals

            if (shortSlots.length === 0) {
                return {
                    text: "🌙 *¡Ya cerramos por hoy!* 🌙\n\nNuestras entregas son hasta las 10:00 PM.\nPor favor intenta de nuevo mañana. ☀️",
                    useButtons: true,
                    buttons: ['Menú Principal']
                };
            }

            return {
                text: `📍 * Recoger en Tienda *\n\n¿A qué hora pasas por tu pedido ? `,
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
                                id: `time_${s} `,
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

        const { total, summary } = calculateCheckoutSummary(product, checkout.selections, checkout.totalPrice);

        let deliveryText = "";
        if (checkout.deliveryMethod === 'delivery') {
            // Show start of address
            const shortAddr = checkout.fullAddress ? checkout.fullAddress.substring(0, 30) + (checkout.fullAddress.length > 30 ? '...' : '') : 'Ubicación compartida';
            deliveryText = `🚗 Domicilio\n📍 ${shortAddr} \n🕒 Hora: ${checkout.pickupTime} `;
        } else {
            deliveryText = `🏪 Recoger: ${checkout.pickupTime} `;
        }

        return {
            text: `📋 * RESUMEN DE TU ORDEN *\n\n${summary} \n\n------------------\n👤 * Nombre:* ${checkout.customerName} \n${deliveryText} \n💰 * TOTAL: $${total}*\n------------------\n\n¿Todo correcto ? Responde * Sí * para confirmar o * Cancelar * para reiniciar.`
        };
    }

    // Step 3: SHOW_SUMMARY (Confirmation)
    if (checkout.checkoutStep === 'SHOW_SUMMARY') {
        if (lowerText.includes('cancelar') || lowerText.includes('btn_1') || (lowerText === 'btn_1')) { // FIX: Robust check

            return {
                text: "❌ Orden cancelada. ¿Quieres empezar de nuevo?",
                useButtons: true,
                buttons: ['Armar un Poke', 'Ver Menú']
            };
        }

        // Accept multiple confirmation phrases
        const confirmPhrases = ['confirmar', 'sí', 'si', 'ok', 'okay', 'yes', 'ya', 'dale', 'listo', 'btn_0'];
        const isConfirmed = confirmPhrases.some(phrase => lowerText.includes(phrase));

        if (!isConfirmed) {
            return {
                text: "⚠️ Por favor confirma tu orden escribiendo *Sí* o *Cancelar* para reiniciar."
            };
        }

        // CREATE ORDER IN DATABASE
        const product = await getProductWithSteps(checkout.productSlug);
        if (!product) {
            return { text: "Error: Producto no encontrado." };
        }

        const { items } = calculateCheckoutSummary(product, checkout.selections, checkout.totalPrice);

        // --- PRE-ORDER CHECK ---
        const mxTime = new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" });
        const currentHour = new Date(mxTime).getHours();
        const isPreOrder = currentHour < 14;

        const orderData = {
            customer_name: checkout.customerName,
            phone: from,
            total: checkout.totalPrice,
            status: isPreOrder ? 'pre_order' : 'pending', // <--- PRE-ORDER STATUS
            items: items,
            delivery_method: checkout.deliveryMethod,
            pickup_time: checkout.pickupTime,
            address: checkout.address || checkout.fullAddress || '', // Fallback
            address_references: checkout.addressReferences || '',
            location: checkout.location,
            payment_status: 'pending',
            created_at: new Date().toISOString()
        };

        const { error } = await supabase.from('orders').insert(orderData);
        if (error) {
            console.error("Error inserting order:", error);
            return {
                text: "⚠️ Hubo un error al procesar tu orden. Por favor intenta de nuevo."
            };
        }

        // --- SAVE TO HISTORY FOR RECOMMENDATIONS (Robustness) ---
        try {
            const { saveOrderToHistory } = await import('./orderHistoryService.ts');
            await saveOrderToHistory({
                phone: from,
                customer_name: checkout.customerName,
                items: [{
                    id: String(product.slug || product.id),
                    name: product.name,
                    price: checkout.totalPrice,
                    quantity: 1
                }],
                total: checkout.totalPrice,
                delivery_method: checkout.deliveryMethod,
                location: checkout.location, // GPS
                full_address: checkout.fullAddress,
                address_references: checkout.addressReferences
            });
        } catch (histError) {
            console.error("Non-fatal error saving history:", histError);
        }

        // --- CONFIRMATION MESSAGE ---
        if (isPreOrder) {
            return {
                text: `🔒 * PRE - ORDEN GUARDADA * 🔒\n\nTu pedido ha sido registrado con éxito para el turno de la tarde.\n\n⏰ * A las 2:00 PM te enviaremos un mensaje * para confirmar que empezamos a cocinar.\n\n¡Gracias por la espera, ${checkout.customerName} ! 🍣⏳`,
                useButtons: true,
                buttons: ['Ver Menú']
            };
        }

        return {
            text: `🎉 *¡ORDEN CONFIRMADA! * 🎉\n\n🧾 EN PREPARACIÓN.Su orden ha sido confirmada y nuestra cocina ha comenzado a prepararla.\n\n¡Gracias por tu preferencia, ${checkout.customerName} ! 🥢✨`,
            useButtons: true,
            buttons: ['Menú Principal']
        };
    }

    return { text: "Error en el flujo de checkout." };
}

function calculateCheckoutSummary(product: any, selections: Record<number, number[]>, totalPrice: number) {
    let summary = `* ${product.name}* `;
    const itemsJson: any = {
        name: product.name,
        productType: product.type || 'bowl',
        base_price: product.base_price
    };

    product.steps.forEach((step: any) => {
        const selectedOptionIds = selections[step.id] || [];
        const selectedOptions = step.options.filter((o: any) => selectedOptionIds.includes(o.id));

        if (selectedOptions.length > 0) {
            summary += `\n\n * ${step.label}:* `;
            const optionNames = selectedOptions.map((o: any) => `• ${o.name} `).join('\n');
            summary += `\n${optionNames} `;

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
    const now = new Date();
    const mxDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
    const currentHour = mxDate.getHours();

    // Fetch Business Hours
    const { open, close } = await getBusinessHours();

    // Pre-Order Logic: If before Open, start at Open Time
    if (currentHour < open) {
        mxDate.setHours(open, 0, 0, 0);
        // Reset minutes? Yes, exactly at opening.
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
