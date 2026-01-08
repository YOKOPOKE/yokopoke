"use server";

import { createClient } from "@/lib/supabase";
import { notifyAdminNewOrder } from "@/lib/whatsapp";
import { OrderItem } from "@/context/CartContext";

export async function submitOrder(formData: any, items: OrderItem[], total: number) {
    const supabase = createClient();

    // 1. Insert into 'orders' table
    // Note: We need to make sure the 'orders' table exists and matches this structure.
    // Based on previous context, we might need to create it or infer it.
    // For now, I'll assume a basic structure or create a migration if needed.

    // Determine initial status based on payment intent
    // If this is triggering a Stripe checkout, we might want 'awaiting_payment'
    // But CartDrawer calls this generically. Let's accept a 'paymentMethod' param.

    const paymentMethod = formData.paymentMethod || 'cash';
    const initialStatus = paymentMethod === 'card' ? 'awaiting_payment' : 'pending';
    const initialPaymentStatus = paymentMethod === 'card' ? 'unpaid' : 'pending_cash';

    const { data: order, error } = await supabase.from('orders').insert({
        customer_name: formData.name,
        customer_phone: formData.phone,
        customer_address: formData.address,
        total: total,
        status: initialStatus,
        payment_status: initialPaymentStatus,
        payment_method: paymentMethod,
        items: items, // Storing JSONB
        notes: formData.instructions || ''
    }).select().single();

    if (error) {
        console.error("Order Insert Error:", error);
        return { success: false, error: error.message };
    }

    // 2. Notification handled by Supabase Edge Function (Database Webhook)
    // await notifyAdminNewOrder(order.id, formData.name, total);

    return { success: true, orderId: order.id };
}
