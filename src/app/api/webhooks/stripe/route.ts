import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
    const body = await req.text();
    const signature = (await headers()).get('stripe-signature') as string;

    let event: Stripe.Event;
    const stripe = getStripe();


    try {
        if (!webhookSecret) {
            console.error("Missing STRIPE_WEBHOOK_SECRET");
            return new NextResponse('Webhook Error: Missing Secret', { status: 500 });
        }
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        console.error(`Webhook signature verification failed.`, err.message);
        return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const orderId = session.metadata?.orderId;

            if (orderId) {
                console.log(`💰 Payment succeeded for Order ${orderId}`);

                const supabase = createClient();
                const { error } = await supabase
                    .from('orders')
                    .update({
                        status: 'pending', // Move to 'pending' so it shows up in Kitchen "Por Aceptar"
                        payment_status: 'paid',
                        payment_method: 'card'
                    })
                    .eq('id', orderId);

                if (error) {
                    console.error('Error updating order status:', error);
                    return new NextResponse('Database Error', { status: 500 });
                }
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Webhook handler failed:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
