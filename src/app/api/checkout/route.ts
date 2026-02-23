import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

interface CheckoutItem {
    name?: string;
    productType?: string;
    price: number;
    image?: string;
    details?: { value: string }[];
}

export async function POST(req: Request) {
    try {
        const stripe = getStripe();

        const body = await req.json();
        const { items, orderId, customerEmail } = body;

        if (!items || !Array.isArray(items) || items.length === 0 || !orderId) {
            return new NextResponse('Missing required fields', { status: 400 });
        }

        // Determine Base URL
        const origin = req.headers.get('origin') || 'http://localhost:3000';

        const lineItems = (items as CheckoutItem[]).map((item) => {
            // Server-side price validation
            const price = Number(item.price);
            if (!price || price <= 0 || price > 10000) {
                throw new Error('INVALID_PRICE');
            }

            let description = item.productType === 'bowl' ? 'Poke Bowl' : 'Sushi Burger';
            if (item.details?.length && item.details.length > 0) {
                description += ' (' + item.details.map((d) => d.value).join(', ') + ')';
            }

            return {
                price_data: {
                    currency: 'mxn',
                    product_data: {
                        name: item.name || (item.productType === 'bowl' ? 'Poke Bowl' : 'Sushi Burger'),
                        description: description.slice(0, 100),
                        images: item.image ? [item.image] : [],
                    },
                    unit_amount: Math.round(price * 100),
                },
                quantity: 1,
            };
        });

        const session = await stripe.checkout.sessions.create({
            line_items: lineItems,
            mode: 'payment',
            ui_mode: 'embedded',
            return_url: `${origin}/return?session_id={CHECKOUT_SESSION_ID}&orderId=${orderId}`,
            metadata: {
                orderId: orderId,
            },
            customer_email: customerEmail || undefined,
        });

        return NextResponse.json({ clientSecret: session.client_secret });

    } catch (error: unknown) {
        console.error("Stripe Checkout Error:", error);

        // Don't expose internal error details to the client
        const message = error instanceof Error && error.message === 'INVALID_PRICE'
            ? 'Precio inválido detectado. Intenta de nuevo.'
            : 'Error al procesar el pago. Intenta de nuevo.';

        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
