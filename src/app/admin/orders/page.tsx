"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
    CheckCircle, RefreshCw, User, ShoppingBag, MapPin,
    ChefHat, Flame, Timer, BarChart3, ChevronDown,
    Search, Bell, Filter, MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/context/ToastContext';

export const dynamic = 'force-dynamic';

// Types
type Order = {
    id: number;
    created_at: string;
    customer_name: string;
    total: number;
    status: 'pending' | 'preparing' | 'completed' | 'cancelled' | 'awaiting_payment' | 'out_for_delivery';
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
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const update = () => {
            const created = new Date(dateString);
            const now = new Date();
            const diffMs = now.getTime() - created.getTime();
            setElapsed(Math.floor(diffMs / 60000));
        };
        update();
        const interval = setInterval(update, 60000);
        return () => clearInterval(interval);
    }, [dateString]);

    return elapsed;
};

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'preparing' | 'out_for_delivery' | 'completed'>('pending');
    const { showToast } = useToast();

    // Supabase
    // const supabase = createClient();

    const fetchOrders = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
            showToast('Error al cargar pedidos', 'error');
        } else {
            setOrders(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();

        const channel = supabase
            .channel('admin_orders')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: any) => {
                const newOrder = payload.new as Order;
                setOrders(prev => [newOrder, ...prev]);
                showToast(`Nuevo pedido: #${newOrder.id}`, 'success');
                // Play sound if needed
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload: any) => {
                const updated = payload.new as Order;
                if (updated.status === 'pending' && payload.old.status === 'awaiting_payment') {
                    setOrders(prev => {
                        if (prev.some(o => o.id === updated.id)) return prev.map(o => o.id === updated.id ? updated : o);
                        return [updated, ...prev];
                    });
                } else {
                    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const updateStatus = async (id: number, status: string) => {
        // Optimistic Update
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as any } : o));

        try {
            const { error } = await supabase.from('orders').update({ status }).eq('id', id);
            if (error) throw error;

            let message = 'Estado actualizado';
            if (status === 'preparing') message = '🔥 A cocinar...';
            if (status === 'out_for_delivery') message = '🛵 Pedido en camino';
            if (status === 'completed') message = '✅ Pedido completado';

            showToast(message, 'success');
        } catch (e) {
            console.error(e);
            showToast('Error al actualizar status', 'error');
            fetchOrders();
        }
    };

    // Stats Logic
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const preparingCount = orders.filter(o => o.status === 'preparing').length;
    const completedCount = orders.filter(o => o.status === 'completed').length;
    const outForDeliveryCount = orders.filter(o => o.status === 'out_for_delivery').length;

    // Revenue logic (Today)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayOrders = orders.filter(o => new Date(o.created_at) >= todayStart && o.status !== 'cancelled');
    const totalRevenue = todayOrders.reduce((acc, curr) => acc + curr.total, 0);

    const tabs = [
        { id: 'pending', label: 'Por Aceptar', count: pendingCount, icon: <Flame size={18} /> },
        { id: 'preparing', label: 'Cocinando', count: preparingCount, icon: <ChefHat size={18} /> },
        { id: 'out_for_delivery', label: 'En Ruta', count: outForDeliveryCount, icon: <MapPin size={18} /> },
        { id: 'completed', label: 'Entregados', count: completedCount, icon: <CheckCircle size={18} /> },
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans text-slate-800">
            {/* --- DASHBOARD HEADER & STATS --- */}
            <div className="max-w-[1600px] mx-auto space-y-8">

                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Panel de Control</h1>
                        <p className="text-sm text-slate-400 font-medium">Bienvenido de nuevo, Chef.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Search Bar (Visual) */}
                        <div className="hidden md:flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm focus-within:border-slate-300 transition-all">
                            <Search size={18} className="text-slate-400" />
                            <input placeholder="Buscar pedido..." className="bg-transparent outline-none text-sm font-medium w-48" />
                        </div>

                        <button onClick={fetchOrders} className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors relative">
                            <Bell size={20} />
                            {pendingCount > 0 && <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-rose-500" />}
                        </button>
                    </div>
                </div>

                {/* Stats Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Stats Card 1: Total Orders */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-100 to-orange-50 flex items-center justify-center text-rose-500 shadow-inner">
                            <ShoppingBag size={24} />
                        </div>
                        <div>
                            <p className="text-3xl font-black text-slate-900">{orders.length}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total Pedidos</p>
                        </div>
                    </div>

                    {/* Stats Card 2: Revenue */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center text-green-500 shadow-inner">
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <p className="text-3xl font-black text-slate-900">${totalRevenue.toLocaleString()}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ingresos Hoy</p>
                        </div>
                    </div>

                    {/* Stats Card 3: Pending (Actionable) */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-rose-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-14 h-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                            <Flame size={24} fill="currentColor" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-3xl font-black text-slate-900">{pendingCount}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Pendientes</p>
                        </div>
                    </div>

                    {/* Stats Card 4: Happiness/Other */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
                            <User size={24} />
                        </div>
                        <div>
                            <p className="text-3xl font-black text-slate-900">{todayOrders.length}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Clientes Hoy</p>
                        </div>
                    </div>
                </div>

                {/* --- MAIN CONTENT AREA --- */}
                <div className="flex flex-col gap-6">

                    {/* Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {tabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            const activeClass = isActive
                                ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                                : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100';

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeClass}`}
                                >
                                    {tab.icon}
                                    <span>{tab.label}</span>
                                    {tab.count > 0 && (
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Orders Grid */}
                    <motion.div
                        layout
                        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 content-start min-h-[500px]"
                    >
                        <AnimatePresence mode='popLayout'>
                            {orders
                                .filter(o => o.status === activeTab)
                                .map(order => (
                                    <div key={order.id} className="w-full">
                                        <KitchenTicketCard order={order} updateStatus={updateStatus} />
                                    </div>
                                ))
                            }
                        </AnimatePresence>

                        {/* Empty State */}
                        {orders.filter(o => o.status === activeTab).length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-50">
                                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <ChefHat size={40} className="text-slate-300" />
                                </div>
                                <p className="font-bold text-slate-400">No hay órdenes en esta sección</p>
                            </div>
                        )}
                    </motion.div>
                </div>

            </div>
        </div>
    );
}

// --- NEW COMPONENT: PREMIUM KITCHEN TICKET CARD ---
const KitchenTicketCard = ({ order, updateStatus }: { order: Order, updateStatus: any }) => {
    const elapsed = useElapsedMinutes(order.created_at);

    // Status Logic
    const isPending = order.status === 'pending';
    const isPreparing = order.status === 'preparing';
    const isOutForDelivery = order.status === 'out_for_delivery';

    // Timer Traffic Light
    let timerColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (elapsed > 10) timerColor = 'bg-amber-50 text-amber-600 border-amber-100';
    if (elapsed > 20) timerColor = 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse font-bold';

    // Branding Colors
    const borderColor = isPending ? 'bg-rose-500' : isPreparing ? 'bg-blue-500' : isOutForDelivery ? 'bg-amber-500' : 'bg-green-500';
    const statusLabel = isPending ? 'PENDIENTE' : isPreparing ? 'COCINANDO' : isOutForDelivery ? 'EN RUTA' : 'LISTO';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="group relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
        >
            {/* Top Status Border */}
            <div className={`h-1.5 w-full ${borderColor}`} />

            {/* Header Section */}
            <div className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${borderColor.replace('bg-', 'text-').replace('500', '600')} bg-white border border-current shadow-sm`}>
                            {statusLabel}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">#{order.id}</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight truncate w-full" title={order.customer_name}>
                        {order.customer_name}
                    </h3>
                </div>

                {/* Timer Badge */}
                <div className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border ${timerColor} shadow-sm`}>
                    <Timer size={14} />
                    <span>{elapsed}m</span>
                </div>
            </div>

            {/* Meta Info Row */}
            <div className="px-5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-500 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-3">
                    {order.delivery_method === 'pickup' ? (
                        <span className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">
                            <ShoppingBag size={12} /> Pickup
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            <MapPin size={12} /> Delivery
                        </span>
                    )}
                    <span className="text-slate-300">|</span>
                    <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()}</span>
                </div>
                {order.payment_status === 'paid' && (
                    <span className="text-emerald-600 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                        <CheckCircle size={10} /> Pagado
                    </span>
                )}
            </div>

            {/* Items List (Kitchen Ticket Style) */}
            <div className="flex-1 overflow-y-auto max-h-[400px]">
                {(Array.isArray(order.items) ? order.items : [order.items]).map((item: any, i) => (
                    <div key={i} className={`p-4 flex gap-3 border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        {/* Qty Box */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm font-black shadow-md shadow-slate-200">
                            1
                        </div>

                        {/* Item Details */}
                        <div className="flex-1">
                            <p className="font-extrabold text-slate-800 text-base leading-tight">
                                {item.name || (item.productType === 'bowl' ? 'Poke Bowl' : 'Sushi Burger')}
                            </p>

                            {/* Modifiers Grid */}
                            <div className="flex flex-col gap-1 mt-2">
                                {item.base && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 w-10 text-right">Base</span>
                                        <span className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-sm">
                                            {item.base.name}
                                        </span>
                                    </div>
                                )}
                                {item.proteins && item.proteins.length > 0 && (
                                    <div className="flex items-start gap-2">
                                        <span className="text-[10px] uppercase font-bold text-rose-400 w-10 text-right mt-0.5">Prot</span>
                                        <div className="flex flex-wrap gap-1">
                                            {item.proteins.map((p: any, idx: number) => (
                                                <span key={idx} className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md">
                                                    {p.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {item.sauce && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase font-bold text-amber-400 w-10 text-right">Salsa</span>
                                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md">
                                            {item.sauce.name}
                                        </span>
                                    </div>
                                )}
                                {item.extras && item.extras.length > 0 && (
                                    <div className="flex items-start gap-2 mt-1 pt-1 border-t border-dashed border-slate-200">
                                        <span className="text-[10px] uppercase font-bold text-blue-400 w-10 text-right mt-0.5">Extra</span>
                                        <div className="flex flex-wrap gap-1">
                                            {item.extras.map((e: any, idx: number) => (
                                                <span key={idx} className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0 rounded">
                                                    + {e.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Action Footer (Sticky Bottom) */}
            <div className="p-4 bg-white border-t border-slate-100 mt-auto">
                <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-3 px-1">
                    <span>Total Orden</span>
                    <span className="text-lg text-slate-900 font-black">${order.total}</span>
                </div>

                {isPending && (
                    <button
                        onClick={() => updateStatus(order.id, 'preparing')}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-rose-500 to-orange-600 text-white font-black text-sm shadow-lg shadow-rose-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Flame size={20} fill="currentColor" className="text-white/80 animate-pulse" />
                        EMPEZAR A COCINAR
                    </button>
                )}

                {isPreparing && (
                    <div className="flex gap-2">
                        {order.delivery_method === 'delivery' ? (
                            <button
                                onClick={() => updateStatus(order.id, 'out_for_delivery')}
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-black text-sm shadow-lg shadow-indigo-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <MapPin size={20} />
                                ENVIAR A DOMICILIO
                            </button>
                        ) : (
                            <button
                                onClick={() => updateStatus(order.id, 'completed')}
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-sm shadow-lg shadow-emerald-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle size={20} />
                                MARCAR LISTO
                            </button>
                        )}
                    </div>
                )}

                {isOutForDelivery && (
                    <button
                        onClick={() => updateStatus(order.id, 'completed')}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-sm shadow-lg shadow-emerald-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <CheckCircle size={20} />
                        CONFIRMAR ENTREGA
                    </button>
                )}
            </div>
        </motion.div>
    );
};
