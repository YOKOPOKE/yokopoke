'use client';

import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { X } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function StripeCheckoutModal({ clientSecret }: { clientSecret: string, onClose?: () => void }) {
    return (
        <div className="w-full h-full flex flex-col bg-white">
            <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ clientSecret }}
            >
                <EmbeddedCheckout className="flex-1" />
            </EmbeddedCheckoutProvider>
        </div>
    );
}
