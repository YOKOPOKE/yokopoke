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

    return { success: true, orderId: order.id };
}
