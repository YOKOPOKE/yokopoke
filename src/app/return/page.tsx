'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ReturnPage() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const orderId = searchParams.get('orderId');
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        if (sessionId) {
            // Optional: Fetch session status from API if needed, 
            // but for now we assume success if they land here from the embedded flow usually.
            setStatus('success');
            // Clear cart? Ideally handled by context, but difficult from a redirect page without global state persistence or local storage check.
            // For now, we rely on the user manually clearing or the webhook confirming backend state.
            localStorage.removeItem('cart');
        }
    }, [sessionId]);

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
                    <CheckCircle size={48} />
                </div>
                <h1 className="text-3xl font-black text-slate-800 mb-2">¡Pago Exitoso!</h1>
                <p className="text-slate-500 mb-8 max-w-md">
                    Tu orden #{orderId?.slice(0, 8)} ha sido confirmada y enviada a cocina.
                    Te hemos enviado un mensaje de confirmación.
                </p>
                <Link
                    href="/"
                    className="bg-slate-900 text-white font-bold py-4 px-8 rounded-full flex items-center gap-2 hover:bg-black transition-all"
                >
                    Volver al Inicio <ArrowRight size={20} />
                </Link>
            </div>
        );
    }

    return null;
}
