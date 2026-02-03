import { SessionData, CheckoutState } from './session.ts';
import { getProductWithSteps } from './productService.ts';
import { BotResponse, ButtonMessage } from './index.ts';
import { supabase } from './productService.ts';

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
        checkout.deliveryMethod = deliveryMethod;

        if (deliveryMethod === 'pickup') {
            checkout.checkoutStep = 'COLLECT_PICKUP_TIME';

            const slots = generateTimeSlots();
            const buttons = slots.slice(0, 3).map(s => `🕒 ${s}`); // Max 3 buttons

            // If more than 3 slots, maybe just show 3 for now or list body
            const slotsText = slots.map(s => `• ${s}`).join('\n');

            return {
                text: `📍 *Recoger en Tienda*\n\n¿A qué hora pasas por tu pedido? (Estimado)\n\n${slotsText}\n\nSelecciona una hora 👇`,
                useButtons: true,
                buttons: slots.slice(0, 3)
            };
        } else {
            // Delivery - Go to Summary (or Address if implemented later)
            checkout.checkoutStep = 'SHOW_SUMMARY';

            // Get product to show summary
            const product = await getProductWithSteps(checkout.productSlug);
            if (!product) return { text: "Error: Producto no encontrado." };

            const { total, summary } = calculateCheckoutSummary(product, checkout.selections, checkout.totalPrice);

            return {
                text: `📋 *RESUMEN DE TU ORDEN*\n\n${summary}\n\n------------------\n👤 *Nombre:* ${checkout.customerName}\n📍 *Entrega:* 🚗 Envío a domicilio\n💰 *TOTAL: $${total}*\n------------------\n\n¿Todo correcto?`,
                useButtons: true,
                buttons: ['✅ Confirmar Orden', '❌ Cancelar']
            };
        }
    }

    // Step 2.5: COLLECT_PICKUP_TIME
    if (checkout.checkoutStep === 'COLLECT_PICKUP_TIME') {
        // Validate time selection
        // Accept any text basically, but prioritize button clicks
        // Clean text to match slot format if possible, or just accept whatever they typed

        let selectedTime = text.replace(/[🕒✅]/g, '').trim();

        // Basic validation: length
        if (selectedTime.length < 3) {
            const slots = generateTimeSlots();
            return {
                text: "⚠️ Por favor selecciona una hora válida:",
                useButtons: true,
                buttons: slots.slice(0, 3)
            };
        }

        checkout.pickupTime = selectedTime;
        checkout.checkoutStep = 'SHOW_SUMMARY';

        const product = await getProductWithSteps(checkout.productSlug);
        if (!product) return { text: "Error: Producto no encontrado." };

        const { total, summary } = calculateCheckoutSummary(product, checkout.selections, checkout.totalPrice);
        const deliveryText = `🏪 Recoger: ${selectedTime}`;

        return {
            text: `📋 *RESUMEN DE TU ORDEN*\n\n${summary}\n\n------------------\n👤 *Nombre:* ${checkout.customerName}\n📍 *Entrega:* ${deliveryText}\n💰 *TOTAL: $${total}*\n------------------\n\n¿Todo correcto?`,
            useButtons: true,
            buttons: ['✅ Confirmar Orden', '❌ Cancelar']
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

        if (!lowerText.includes('confirmar') && lowerText !== 'btn_0') {
            return {
                text: "⚠️ Por favor confirma o cancela tu orden:",
                useButtons: true,
                buttons: ['✅ Confirmar Orden', '❌ Cancelar']
            };
        }

        // CREATE ORDER IN DATABASE
        const product = await getProductWithSteps(checkout.productSlug);
        if (!product) {
            return { text: "Error: Producto no encontrado." };
        }

        const { items } = calculateCheckoutSummary(product, checkout.selections, checkout.totalPrice);

        const orderData = {
            customer_name: checkout.customerName,
            phone: from,
            total: checkout.totalPrice,
            status: 'pending',
            items: items,
            delivery_method: checkout.deliveryMethod,
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

        return {
            text: `🎉 *¡ORDEN CONFIRMADA!* 🎉\n\n🧾 EN PREPARACIÓN. Su orden ha sido confirmada y nuestra cocina ha comenzado a prepararla.\n\n¡Gracias por tu preferencia, ${checkout.customerName}! 🥢✨`,
            useButtons: true,
            buttons: ['Menú Principal']
        };
    }

    return { text: "Error en el flujo de checkout." };
}

function calculateCheckoutSummary(product: any, selections: Record<number, number[]>, totalPrice: number) {
    let summary = `*${product.name}*`;
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

function generateTimeSlots(): string[] {
    const now = new Date();
    // Convert to America/Mexico_City
    // Note: Deno deploy supports IANA timezones
    const mxDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));

    // Start 20 mins from now (Prep time)
    mxDate.setMinutes(mxDate.getMinutes() + 20);

    // Round up to next 20 interval
    const remainder = mxDate.getMinutes() % 20;
    if (remainder !== 0) {
        mxDate.setMinutes(mxDate.getMinutes() + (20 - remainder));
    }
    mxDate.setSeconds(0);
    mxDate.setMilliseconds(0);

    const slots: string[] = [];
    // Generate next 5 slots
    for (let i = 0; i < 5; i++) {
        // Format: HH:MM AM/PM
        const timeStr = mxDate.toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit', hour12: true });
        slots.push(timeStr);
        mxDate.setMinutes(mxDate.getMinutes() + 20);
    }
    return slots;
}
