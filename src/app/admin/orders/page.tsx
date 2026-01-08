"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { Clock, CheckCircle, RefreshCw, User, ShoppingBag, MapPin, Phone, TrendingUp, AlertCircle, ChefHat, Sparkles, Flame, Timer, BarChart3, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/components/ui/Toast';

export const dynamic = 'force-dynamic';

// Types
type Order = {
    id: number;
    created_at: string;
    customer_name: string;
    total: number;
    status: 'pending' | 'preparing' | 'completed' | 'cancelled' | 'awaiting_payment';
    payment_status?: string;
    payment_method?: string;
    delivery_method: 'delivery' | 'pickup';
    items: any[];
    address?: string;
    phone?: string;
    pickup_time?: string;
};

// Hook for elapsed time
const useElapsedMinutes = (dateString: string) => {
    const [minutes, setMinutes] = useState(0);
    useEffect(() => {
        const update = () => {
            const diff = new Date().getTime() - new Date(dateString).getTime();
            setMinutes(Math.floor(diff / 60000));
        };
        update();
        const interval = setInterval(update, 30000);
        return () => clearInterval(interval);
    }, [dateString]);
    return minutes;
};

export default function AdminOrdersPage() {
    const supabase = createClient();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
    const [activeTab, setActiveTab] = useState<'pending' | 'preparing' | 'completed'>('pending');
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize Audio
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.loop = true;
            audioRef.current = audio;
        }
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        };
    }, []);

    // Audio Logic Trigger
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        // Play only if there is an incoming order (pending & un-acknowledged)
        // We use a timestamp check or just the presence of incomingOrder to decide
        if (incomingOrder) {
            audio.play().catch((err) => console.log('Audio autoplay blocked:', err));
        } else {
            audio.pause();
            audio.currentTime = 0;
        }
    }, [incomingOrder]);

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    const fetchOrders = async () => {
        setLoading(true);
        // Fetch orders, but exclude those stuck in 'awaiting_payment' (abandoned checkout)
        const { data } = await supabase.from('orders')
            .select('*')
            .neq('status', 'awaiting_payment')
            .order('created_at', { ascending: false })
            .limit(50);
        if (data) setOrders(data as Order[]);
        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();
        const channel = supabase
            .channel('kitchen-ultra-v3')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
                const newOrder = payload.new as Order;
                // Ignore if it's just created but waiting for payment
                if (newOrder.status === 'awaiting_payment') return;

                setOrders(prev => [newOrder, ...prev]);
                setIncomingOrder(newOrder);
                toast.success(`🎉 Pedido nuevo: ${newOrder.customer_name}`);
            })
            // Listen for UPDATES (e.g. when Stripe Webhook flips it to 'pending')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
                const updated = payload.new as Order;
                if (updated.status === 'pending' && payload.old.status === 'awaiting_payment') {
                    // This is a successful payment coming in!
                    setOrders(prev => [updated, ...prev]);
                    setIncomingOrder(updated);
                    toast.success(`💸 Pago confirmado: ${updated.customer_name}`);
                } else {
                    // Standard status update
                    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') toast.info('👩‍🍳 Cocina Sincronizada');
            });
        return () => { supabase.removeChannel(channel); };
    }, []);

    const updateStatus = async (id: number, status: string) => {
        // Optimistic Update
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as any } : o));

        // If the updated order was the incoming one, verify it clears
        if (incomingOrder?.id === id) {
            setIncomingOrder(null);
            stopAudio();
        }

        try {
            const { error } = await supabase.from('orders').update({ status }).eq('id', id);

            if (error) {
                throw error;
            }

            toast.success(status === 'preparing' ? '🔥 A cocinar...' : '✅ Pedido completado');
        } catch (e) {
            console.error(e);
            toast.error('Error al actualizar status');
            // Revert changes if needed or re-fetch
            fetchOrders();
        }
    };

    const handleReject = async () => {
        if (!incomingOrder) return;
        setOrders(prev => prev.filter(o => o.id !== incomingOrder.id));
        await supabase.from('orders').update({ status: 'cancelled' }).eq('id', incomingOrder.id);
        setIncomingOrder(null);
        toast.info('Pedido archivado');
    };

    // Stats Logic
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const preparingCount = orders.filter(o => o.status === 'preparing').length;
    const completedCount = orders.filter(o => o.status === 'completed').length;
    const totalRevenue = orders.reduce((acc, curr) => acc + (curr.status !== 'cancelled' ? curr.total : 0), 0);

    // Mock Data for Mini Chart (Last 5 orders amount)
    const recentSales = orders.slice(0, 7).map(o => o.total).reverse();
    const maxSale = Math.max(...recentSales, 100);

    const tabs = [
        { id: 'pending', label: 'Por Aceptar', icon: <Flame size={18} />, count: pendingCount, color: 'from-amber-500 to-orange-500' },
        { id: 'preparing', label: 'Cocinando', icon: <ChefHat size={18} />, count: preparingCount, color: 'from-blue-500 to-indigo-500' },
        { id: 'completed', label: 'Resumen', icon: <CheckCircle size={18} />, count: completedCount, color: 'from-green-500 to-emerald-500' },
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-24 md:pb-0 relative overflow-hidden">

            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-200/50 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-200/50 blur-[100px]" />
            </div>

            {/* --- INCOMING ORDER MODAL --- */}
            <AnimatePresence>
                {incomingOrder && (
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
                                <div className="flex items-center justify-between mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">{incomingOrder.customer_name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            {incomingOrder.delivery_method === 'pickup' ? (
                                                <span className="flex items-center gap-1 text-xs font-bold bg-orange-100/80 text-orange-700 px-2.5 py-1 rounded-full border border-orange-200/50">
                                                    <ShoppingBag size={12} /> Recoger {incomingOrder.pickup_time}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs font-bold bg-indigo-100/80 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200/50">
                                                    <User size={12} /> Domicilio
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total</span>
                                        <span className="font-mono text-3xl font-black text-rose-600 tracking-tight">${incomingOrder.total}</span>
                                    </div>
                                </div>

                                <div className="space-y-4 max-h-[30vh] overflow-y-auto custom-scrollbar pr-2 mb-8">
                                    {Array.isArray(incomingOrder.items) && incomingOrder.items.map((item: any, i: number) => (
                                        <div key={i} className="flex gap-4 items-center p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                                            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm shrink-0">1</div>
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
                                    <button onClick={() => setIncomingOrder(null)} className="py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-900/30 hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 relative overflow-hidden group">
                                        <span className="relative z-10">Aceptar Orden</span>
                                        <CheckCircle className="relative z-10" size={18} />
                                        <div className="absolute inset-0 bg-gradient-to-r from-slate-800 to-black group-hover:bg-slate-800 transition-colors" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- DASHBOARD HEADER --- */}
            <div className="sticky top-0 z-40">
                <div className="absolute inset-0 bg-white/80 backdrop-blur-xl border-b border-white/40 shadow-sm" />

                <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                        {/* Left: Brand & Time */}
                        <div className="flex items-center gap-4">
                            <div className="bg-gradient-to-br from-rose-500 to-orange-500 text-white p-2.5 rounded-xl shadow-lg shadow-rose-500/30">
                                <ChefHat size={24} />
                            </div>
                            <div>
                                <h1 className="font-black text-xl tracking-tight text-slate-800">YOKO KITCHEN</h1>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live System
                                </p>
                            </div>
                        </div>

                        {/* Center: Analytics Cards */}
                        <div className="hidden md:flex items-center gap-4">
                            {/* Revenue Card */}
                            <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/60 p-2 pr-4 flex items-center gap-3">
                                <div className="bg-green-100 text-green-600 p-2 rounded-xl">
                                    <BarChart3 size={18} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Ventas Hoy</span>
                                    <span className="text-sm font-black text-slate-800">${totalRevenue.toLocaleString()}</span>
                                </div>
                                {/* Mini Sparkline Chart */}
                                <div className="flex items-end gap-0.5 h-6 pl-2">
                                    {recentSales.map((val, i) => (
                                        <div key={i} style={{ height: `${(val / maxSale) * 100}%` }} className="w-1 bg-green-200 rounded-t-sm" />
                                    ))}
                                </div>
                            </div>

                            {/* Orders Card */}
                            <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/60 p-2 pr-4 flex items-center gap-3">
                                <div className="bg-blue-100 text-blue-600 p-2 rounded-xl">
                                    <ShoppingBag size={18} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Entregados</span>
                                    <span className="text-sm font-black text-slate-800">{completedCount} / {orders.length}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2">
                            <div className="hidden md:flex bg-slate-100 p-1 rounded-full mr-2">
                                <button onClick={() => setViewMode('kanban')} className={`p-2 rounded-full transition-all ${viewMode === 'kanban' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}><BarChart3 size={16} className="rotate-90" /></button>
                                <button onClick={() => setViewMode('list')} className={`p-2 rounded-full transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}><BarChart3 size={16} /></button>
                            </div>
                            <button onClick={fetchOrders} className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-slate-50 border border-slate-200 shadow-sm text-slate-500 hover:text-slate-800 transition-all active:scale-95">
                                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            </button>
                            <button onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); setTimeout(() => audioRef.current?.pause(), 1000) } }} className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-slate-50 border border-slate-200 shadow-sm text-slate-500 hover:text-slate-800 transition-all active:scale-95">
                                <Sparkles size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Mobile Analytics Summary */}
                    <div className="md:hidden grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-white/50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500">Ventas</span>
                            <span className="text-sm font-black text-slate-800">${totalRevenue}</span>
                        </div>
                        <div className="bg-white/50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500">Pedidos</span>
                            <span className="text-sm font-black text-slate-800">{orders.length}</span>
                        </div>
                    </div>
                </div>

                {/* Mobile Tabs */}
                <div className="md:hidden flex justify-center pb-2 relative z-10 px-4 mt-2">
                    <div className="flex bg-white/80 backdrop-blur-md p-1 rounded-2xl shadow-sm border border-slate-200/60 w-full">
                        {tabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex-1 relative flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${isActive ? 'text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                                >
                                    {isActive && (
                                        <motion.div layoutId="activeTab" className={`absolute inset-0 bg-gradient-to-r ${tab.color} rounded-xl`} />
                                    )}
                                    <span className="relative z-10 flex items-center gap-1.5">
                                        {tab.count > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>}
                                        {tab.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* --- MAIN GRID --- */}
            <div className="max-w-7xl mx-auto p-4 md:p-8 relative z-10">

                {/* Desktop View */}
                <div className="hidden md:grid md:grid-cols-4 gap-6 h-[calc(100vh-160px)]">

                    {/* Column 1: PENDING (Large) */}
                    <div className="flex flex-col h-full bg-white/40 backdrop-blur-sm rounded-3xl border border-slate-200/60 overflow-hidden">
                        <div className="p-4 bg-white/60 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2"><Flame size={14} className="text-amber-500" /> Por Aceptar</h3>
                            <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded text-xs">{pendingCount}</span>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-4 custom-scrollbar flex-1">
                            <AnimatePresence mode='popLayout'>
                                {orders.filter(o => o.status === 'pending').map(order => (
                                    <OrderCardUltra key={order.id} order={order} updateStatus={updateStatus} />
                                ))}
                            </AnimatePresence>
                            {pendingCount === 0 && <EmptyStateUltra />}
                        </div>
                    </div>

                    {/* Column 2: PREPARING (Large) */}
                    <div className="flex flex-col h-full bg-white/40 backdrop-blur-sm rounded-3xl border border-slate-200/60 overflow-hidden">
                        <div className="p-4 bg-white/60 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2"><ChefHat size={14} className="text-blue-500" /> Cocinando</h3>
                            <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-xs">{preparingCount}</span>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-4 custom-scrollbar flex-1">
                            <AnimatePresence mode='popLayout'>
                                {orders.filter(o => o.status === 'preparing').map(order => (
                                    <OrderCardUltra key={order.id} order={order} updateStatus={updateStatus} />
                                ))}
                            </AnimatePresence>
                            {preparingCount === 0 && <EmptyStateUltra />}
                        </div>
                    </div>

                    {/* Column 3 & 4: COMPLETED (Compact Grid, span 2) */}
                    <div className="col-span-2 flex flex-col h-full bg-white/40 backdrop-blur-sm rounded-3xl border border-slate-200/60 overflow-hidden">
                        <div className="p-4 bg-white/60 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2"><CheckCircle size={14} className="text-green-500" /> Resumen</h3>
                            <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded text-xs">{completedCount}</span>
                        </div>
                        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-2 gap-4">
                                <AnimatePresence mode='popLayout'>
                                    {orders.filter(o => o.status === 'completed').map(order => (
                                        <CompactOrderCard key={order.id} order={order} />
                                    ))}
                                </AnimatePresence>
                            </div>
                            {completedCount === 0 && <EmptyStateUltra />}
                        </div>
                    </div>
                </div>

                {/* Mobile Layout (Standard Stack) */}
                <div className="md:hidden space-y-4">
                    <AnimatePresence mode='popLayout'>
                        {orders.filter(o => o.status === activeTab).map(order => (
                            activeTab === 'completed'
                                ? <CompactOrderCard key={order.id} order={order} mobile />
                                : <OrderCardUltra key={order.id} order={order} updateStatus={updateStatus} />
                        ))}
                    </AnimatePresence>
                    {orders.filter(o => o.status === activeTab).length === 0 && <EmptyStateUltra />}
                </div>

            </div>
        </div>
    );
}

// --- COMPACT & ULTRA COMPONENTS ---

const CompactOrderCard = ({ order, mobile }: { order: Order, mobile?: boolean }) => (
    <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex items-center justify-between group hover:border-green-200 transition-all ${mobile ? 'mb-2' : ''}`}
    >
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                <CheckCircle size={14} />
            </div>
            <div>
                <p className="font-bold text-slate-800 text-sm">{order.customer_name}</p>
                <p className="text-[10px] text-slate-400 font-mono">#{order.id} • ${order.total}</p>
            </div>
        </div>

        <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md block mb-1">
                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {order.delivery_method === 'pickup' ? <ShoppingBag size={12} className="ml-auto text-orange-400" /> : <User size={12} className="ml-auto text-indigo-400" />}
        </div>
    </motion.div>
);

const OrderCardUltra = ({ order, updateStatus }: { order: Order, updateStatus: any }) => {
    const elapsed = useElapsedMinutes(order.created_at);

    // Status Logic
    const isPending = order.status === 'pending';
    const isPreparing = order.status === 'preparing';

    // Timer Style
    let timerStyle = 'text-slate-400 bg-slate-50 border-slate-100';
    if (isPending) {
        if (elapsed > 10) timerStyle = 'text-white bg-red-500 border-red-500 animate-pulse shadow-red-200';
        else if (elapsed > 5) timerStyle = 'text-white bg-amber-500 border-amber-500';
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="group relative bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300"
        >
            {/* Glow Effect on Hover */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[1.5rem] pointer-events-none bg-gradient-to-tr from-transparent via-transparent to-${isPending ? 'amber' : isPreparing ? 'blue' : 'green'}-500/5`} />

            <div className="flex justify-between items-start mb-5 relative z-10">
                <div className="flex flex-col">
                    <span className="font-mono text-[10px] text-slate-400 font-bold tracking-wider mb-1">ID #{order.id}</span>
                    <span className="text-xl font-black text-slate-800 leading-none">{order.customer_name}</span>
                </div>
                <div className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 shadow-sm ${timerStyle}`}>
                    <Timer size={12} /> {elapsed}m
                </div>
            </div>

            {/* Payment Badge */}
            <div className="mb-2">
                {(order.payment_method === 'card') && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${order.payment_status === 'paid'
                            ? 'bg-violet-100 text-violet-700 border-violet-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                        {order.payment_status === 'paid' ? '💳 PAGADO (Stripe)' : '⏳ PAGO PENDIENTE'}
                    </span>
                )}
                {(order.payment_method !== 'card') && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-green-100 text-green-700 border-green-200">
                        💵 EFECTIVO / TRANSFER
                    </span>
                )}
            </div>

            {/* Content Items */}
            <div className="space-y-3 mb-6 relative z-10 pl-1">
                {order.items.map((item: any, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm group/item">
                        <div className="w-5 h-5 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-bold shrink-0 text-slate-400 group-hover/item:text-slate-600 group-hover/item:border-slate-300 transition-colors">1</div>
                        <div className="leading-tight">
                            <p className="font-bold text-slate-700">{item.name || (item.productType === 'bowl' ? 'Poke Bowl' : 'Sushi Burger')}</p>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5 line-clamp-1">
                                {[item.base?.name, ...(item.proteins || []), ...(item.mixins || [])].map((x: any) => x?.name).filter(Boolean).join(', ')}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Actions */}
            <div className="flex items-end justify-between border-t border-slate-50 pt-4 mt-2 relative z-10">
                <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Total</span>
                    <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">${order.total}</span>
                </div>

                <div className="flex gap-2">
                    {isPending && (
                        <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'preparing'); }}
                            className="bg-gradient-to-r from-slate-900 to-slate-800 text-white pl-4 pr-5 py-3 rounded-2xl text-xs font-bold shadow-lg shadow-slate-900/20 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group/btn"
                        >
                            <div className="relative">
                                <div className="absolute inset-0 bg-rose-500 blur-sm opacity-50 animate-pulse" />
                                <Flame size={14} className="text-rose-500 relative z-10" />
                            </div>
                            COCINAR
                        </button>
                    )}
                    {isPreparing && (
                        <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'completed'); }}
                            className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-5 py-3 rounded-2xl text-xs font-bold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <CheckCircle size={16} /> Listo
                        </button>
                    )}
                </div>
            </div>

            {/* Ribbon/Tag for Delivery Method */}
            <div className="absolute -right-3 -top-3">
                {order.delivery_method === 'pickup' ? (
                    <div className="bg-white text-orange-600 shadow-sm border border-orange-100 p-2 rounded-full">
                        <ShoppingBag size={14} strokeWidth={3} />
                    </div>
                ) : (
                    <div className="bg-white text-indigo-600 shadow-sm border border-indigo-100 p-2 rounded-full">
                        <MapPin size={14} strokeWidth={3} />
                    </div>
                )}
            </div>
        </motion.div>
    );
}

const EmptyStateUltra = () => (
    <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
        <div className="w-20 h-20 bg-gradient-to-tr from-slate-100 to-white rounded-3xl shadow-inner border border-white flex items-center justify-center mb-6 transform rotate-6">
            <ChefHat size={36} className="text-slate-300" />
        </div>
        <p className="font-black text-slate-300 text-sm tracking-[0.2em] uppercase">Sin Pedidos</p>
        <p className="text-xs text-slate-300 mt-2 font-medium">Todo bajo control chef ✨</p>
    </div>
);
