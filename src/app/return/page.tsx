'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

function ReturnContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const orderId = searchParams.get('orderId');
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        if (sessionId) {
            setStatus('success');
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

    return (
        <div className="min-h-screen flex items-center justify-center">
            <p className="text-gray-400">Procesando...</p>
        </div>
    );
}

export default function ReturnPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
            <ReturnContent />
        </Suspense>
    );
}
