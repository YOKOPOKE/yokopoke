"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ShoppingBag, User, CheckCircle } from 'lucide-react';
import { useAdmin } from '@/context/AdminContext';
import { useToast } from '@/context/ToastContext';
import { createClient } from '@/lib/supabase';

export default function IncomingOrderModal() {
    const { incomingOrder, setIncomingOrder, stopAudio } = useAdmin();
    const { showToast } = useToast();
    const supabase = createClient();

    if (!incomingOrder) return null;

    const handleReject = async () => {
        if (!incomingOrder) return;
        const orderId = incomingOrder.id;

        // Optimistic UI update
        const tempOrder = incomingOrder;
        setIncomingOrder(null);
        stopAudio();

        const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);

        if (error) {
            console.error(error);
            showToast("Error al cancelar", 'error');
            // Optionally restore state if needed, but for now we keep it simple
        } else {
            showToast('Pedido archivado', 'info');
        }
    };

    const handleAccept = async () => {
        if (!incomingOrder) return;
        const orderId = incomingOrder.id;

        // Optimistic UI
        setIncomingOrder(null);
        stopAudio();

        const { error } = await supabase.from('orders').update({ status: 'preparing' }).eq('id', orderId);

        if (error) {
            console.error(error);
            showToast("Error al aceptar", 'error');
        } else {
            showToast('🔥 A cocinar...', 'success');
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" />
                <motion.div
                    initial={{ scale: 0.8, y: 50, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.4 }}
                    className="bg-white/90 w-full max-w-lg rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden relative z-10 border border-white/50 backdrop-blur-xl"
                >
                    {/* Modal Header */}
                    <div className="bg-gradient-to-br from-rose-500 to-pink-600 text-white p-8 relative overflow-hidden">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full border-2 border-white/20 border-dashed" />
                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className="bg-white/20 p-4 rounded-full mb-4 backdrop-blur-md shadow-inner">
                                <AlertCircle size={40} className="text-white drop-shadow-md" />
                            </div>
                            <h2 className="text-3xl font-black uppercase tracking-tight mb-1 drop-shadow-sm">¡Nueva Comanda!</h2>
                            <p className="text-white/90 font-medium tracking-wide text-sm opacity-90">Requiere atención inmediata</p>
                        </div>
                    </div>

                    {/* Modal Content */}
                    <div className="p-8">
                        <div className="flex items-start justify-between mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{incomingOrder.customer_name}</h3>
                                <p className="text-sm text-slate-500 font-mono mb-2">{incomingOrder.phone}</p>

                                <div className="flex items-center gap-2">
                                    {incomingOrder.delivery_method === 'pickup' ? (
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="flex items-center gap-1 text-xs font-bold bg-orange-100/80 text-orange-700 px-2.5 py-1 rounded-full border border-orange-200/50">
                                                <ShoppingBag size={12} /> Recoger {incomingOrder.pickup_time}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-start gap-2">
                                            <span className="flex items-center gap-1 text-xs font-bold bg-indigo-100/80 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200/50">
                                                <User size={12} /> Domicilio
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Delivery Details Section */}
                                {incomingOrder.delivery_method === 'delivery' && (
                                    <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200/60 max-w-[280px]">
                                        <p className="text-slate-700 font-medium text-xs leading-relaxed">
                                            {incomingOrder.address || incomingOrder.full_address || incomingOrder.location?.address || '📍 Ubicación compartida'}
                                        </p>
                                        {incomingOrder.address_references && (
                                            <p className="text-slate-400 text-[10px] mt-1 italic">
                                                "{incomingOrder.address_references}"
                                            </p>
                                        )}
                                        {(incomingOrder.location?.latitude || incomingOrder.location?.lat) && (
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${incomingOrder.location?.latitude || incomingOrder.location?.lat},${incomingOrder.location?.longitude || incomingOrder.location?.lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-bold text-sky-600 hover:text-sky-800 hover:underline bg-sky-50 px-2 py-1 rounded-md"
                                            >
                                                🗺️ Ver en Mapa
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="text-right shrink-0 ml-4">
                                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total</span>
                                <span className="font-mono text-3xl font-black text-rose-600 tracking-tight">${incomingOrder.total}</span>
                            </div>
                        </div>

                        <div className="space-y-4 max-h-[30vh] overflow-y-auto custom-scrollbar pr-2 mb-8">
                            {Array.isArray(incomingOrder.items) && incomingOrder.items.map((item: any, i: number) => (
                                <div key={i} className="flex gap-4 items-center p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                                    <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm shrink-0">{item.quantity || 1}</div>
                                    <div>
                                        <p className="font-bold text-slate-800">{item.name || 'Bowl Custom'}</p>
                                        <p className="text-xs text-slate-500 font-medium">
                                            {[item.base?.name, ...(item.proteins || []), ...(item.mixins || [])].map((x: any) => x?.name).filter(Boolean).join(', ')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={handleReject} className="py-4 font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all">
                                Ignorar
                            </button>
                            <button onClick={handleAccept} className="py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-900/30 hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 relative overflow-hidden group">
                                <span className="relative z-10">Aceptar Orden</span>
                                <CheckCircle className="relative z-10" size={18} />
                                <div className="absolute inset-0 bg-gradient-to-r from-slate-800 to-black group-hover:bg-slate-800 transition-colors" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
