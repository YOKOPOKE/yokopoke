import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    // apiVersion: '2025-01-27.acacia', // Using default installed version to avoid TS errors
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { items, orderId, customerEmail } = body;

        if (!items || !orderId) {
            return new NextResponse('Missing required fields', { status: 400 });
        }

        // Determine Base URL (Dynamic for localhost vs Vercel)
        const origin = req.headers.get('origin') || 'http://localhost:3000';

        const lineItems = items.map((item: any) => {
            // Construct description from details
            let description = item.productType === 'bowl' ? 'Poke Bowl' : 'Sushi Burger';
            if (item.details?.length > 0) {
                description += ' (' + item.details.map((d: any) => d.value).join(', ') + ')';
            }

            return {
                price_data: {
                    currency: 'mxn',
                    product_data: {
                        name: item.name || (item.productType === 'bowl' ? 'Poke Bowl' : 'Sushi Burger'),
                        description: description.slice(0, 100), // Stripe limit
                        images: item.image ? [item.image] : [],
                    },
                    unit_amount: Math.round(item.price * 100), // Centavos
                },
                quantity: 1,
            };
        });

        const session = await stripe.checkout.sessions.create({
            line_items: lineItems,
            mode: 'payment',
            ui_mode: 'embedded', // Embedded Checkout
            return_url: `${origin}/return?session_id={CHECKOUT_SESSION_ID}&orderId=${orderId}`, // Validation Page
            metadata: {
                orderId: orderId,
            },
            customer_email: customerEmail || undefined,
        });

        return NextResponse.json({ clientSecret: session.client_secret });

    } catch (error: any) {
        console.error("Stripe Checkout Error:", error);
        // Return JSON even on error
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
