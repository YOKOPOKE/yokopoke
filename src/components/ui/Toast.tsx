"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

type ToastEventDetail = {
    message: string;
    type: ToastType;
};

export default function ToastContainer() {
    const [toasts, setToasts] = useState<{ id: number; message: string; type: ToastType }[]>([]);

    useEffect(() => {
        const handleToast = (e: CustomEvent<ToastEventDetail>) => {
            const id = Date.now();
            setToasts(prev => [...prev, { id, ...e.detail }]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 3000);
        };

        window.addEventListener('show-toast' as any, handleToast as any);
        return () => window.removeEventListener('show-toast' as any, handleToast as any);
    }, []);

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.map(toast => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, x: 50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.9 }}
                        layout
                        className="pointer-events-auto min-w-[300px] bg-white rounded-xl shadow-2xl border border-gray-100 p-4 flex items-center gap-4 overflow-hidden relative"
                    >
                        {/* Status Stripe */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${toast.type === 'success' ? 'bg-green-500' :
                                toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                            }`} />

                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-green-100 text-green-600' :
                                toast.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                            {toast.type === 'success' ? <Check size={16} strokeWidth={3} /> :
                                toast.type === 'error' ? <X size={16} strokeWidth={3} /> : <Info size={16} strokeWidth={3} />}
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                            <h4 className={`font-bold text-sm ${toast.type === 'success' ? 'text-green-800' :
                                    toast.type === 'error' ? 'text-red-800' : 'text-blue-800'
                                }`}>
                                {toast.type === 'success' ? '¡Éxito!' :
                                    toast.type === 'error' ? 'Error' : 'Información'}
                            </h4>
                            <p className="text-gray-500 text-xs font-medium">{toast.message}</p>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

// Utility to trigger toast anywhere
export const toast = {
    success: (message: string) => window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type: 'success' } })),
    error: (message: string) => window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type: 'error' } })),
    info: (message: string) => window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type: 'info' } }))
};
