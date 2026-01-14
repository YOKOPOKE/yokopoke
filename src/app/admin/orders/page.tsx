"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { CheckCircle, RefreshCw, User, ShoppingBag, MapPin, ChefHat, Flame, Timer, BarChart3, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/context/ToastContext';

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
    const { showToast } = useToast();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'preparing' | 'completed'>('pending');
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

    // Date Filter State
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'all' | 'custom'>('today');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // NOTE: Audio and IncomingOrderModal are now handled globally in AdminContext/Layout
    // We only manage the list view here.

    const fetchOrders = async () => {
        setLoading(true);

        let query = supabase.from('orders')
            .select('*')
            .neq('status', 'awaiting_payment')
            .order('created_at', { ascending: false });

        // Apply date filter
        if (dateFilter === 'today') {
            const now = new Date();
            const todayStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`;
            const todayEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T23:59:59`;
            query = query.gte('created_at', todayStart).lte('created_at', todayEnd);
        } else if (dateFilter === 'week') {
            const now = new Date();
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
            const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}T00:00:00`;
            query = query.gte('created_at', weekStartStr);
        } else if (dateFilter === 'custom' && startDate && endDate) {
            query = query.gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${endDate}T23:59:59`);
        }
        // 'all' doesn't add any date filter

        const { data } = await query;
        if (data) setOrders(data as Order[]);
        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();
    }, [dateFilter, startDate, endDate]); // Re-fetch when date filter changes

    useEffect(() => {
        const channel = supabase
            .channel('kitchen-ultra-v3')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload: any) => {
                const newOrder = payload.new as Order;
                if (newOrder.status === 'awaiting_payment') return;

                setOrders(prev => {
                    if (prev.some(o => o.id === newOrder.id)) return prev;
                    return [newOrder, ...prev];
                });
                // No toast here, AdminContext handles it
            })
            // Listen for UPDATES
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload: any) => {
                const updated = payload.new as Order;
                if (updated.status === 'pending' && payload.old.status === 'awaiting_payment') {
                    // Stripe confirmation
                    setOrders(prev => {
                        if (prev.some(o => o.id === updated.id)) return prev.map(o => o.id === updated.id ? updated : o);
                        return [updated, ...prev];
                    });
                } else {
                    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
                }
            })
            .subscribe((status: string) => {
                if (status === 'SUBSCRIBED') console.log('Orders List Synced');
            });
        return () => { supabase.removeChannel(channel); };
    }, []);

    const updateStatus = async (id: number, status: string) => {
        // Optimistic Update
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as any } : o));

        try {
            const { error } = await supabase.from('orders').update({ status }).eq('id', id);

            if (error) {
                throw error;
            }

            showToast(status === 'preparing' ? '🔥 A cocinar...' : '✅ Pedido completado', 'success');
        } catch (e) {
            console.error(e);
            showToast('Error al actualizar status', 'error');
            // Revert changes if needed or re-fetch
            fetchOrders();
        }
    };

    // Stats Logic
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const preparingCount = orders.filter(o => o.status === 'preparing').length;
    const completedCount = orders.filter(o => o.status === 'completed').length;

    // Filter orders for TODAY only (using local timezone)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const todaysOrders = orders.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= todayStart && orderDate <= todayEnd;
    });

    const totalRevenue = todaysOrders.reduce((acc, curr) => acc + (curr.status !== 'cancelled' ? curr.total : 0), 0);

    // Mock Data for Mini Chart (Last 5 orders amount from TODAY)
    const recentSales = todaysOrders.slice(0, 7).map(o => o.total).reverse();
    const maxSale = Math.max(...recentSales, 100);

    const tabs = [
        { id: 'pending', label: 'Pendientes', icon: <Flame size={18} />, count: pendingCount, color: 'from-amber-500 to-orange-500' },
        { id: 'preparing', label: 'Cocinando', icon: <ChefHat size={18} />, count: preparingCount, color: 'from-blue-500 to-indigo-500' },
        { id: 'completed', label: 'Entregados', icon: <CheckCircle size={18} />, count: completedCount, color: 'from-green-500 to-emerald-500' },
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-24 md:pb-0 relative overflow-hidden">

            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-200/50 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-200/50 blur-[100px]" />
            </div>

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

                        {/* Date Filter Controls - Premium Responsive */}
                        <div className="hidden lg:flex items-center gap-2 relative">
                            <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-xl rounded-2xl border border-white/50 shadow-lg shadow-slate-200/50 p-1.5 flex items-center gap-1.5">
                                <button
                                    onClick={() => setDateFilter('today')}
                                    className={`group px-4 py-2 rounded-xl text-xs font-black transition-all duration-300 ${dateFilter === 'today' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/40 scale-105' : 'text-slate-600 hover:bg-white/80 hover:text-violet-600 hover:scale-105'}`}
                                >
                                    <span className="flex items-center gap-1.5">
                                        ⚡ Hoy
                                    </span>
                                </button>
                                <button
                                    onClick={() => setDateFilter('week')}
                                    className={`group px-4 py-2 rounded-xl text-xs font-black transition-all duration-300 ${dateFilter === 'week' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/40 scale-105' : 'text-slate-600 hover:bg-white/80 hover:text-violet-600 hover:scale-105'}`}
                                >
                                    <span className="flex items-center gap-1.5">
                                        📊 Semana
                                    </span>
                                </button>
                                <button
                                    onClick={() => setDateFilter('all')}
                                    className={`group px-4 py-2 rounded-xl text-xs font-black transition-all duration-300 ${dateFilter === 'all' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/40 scale-105' : 'text-slate-600 hover:bg-white/80 hover:text-violet-600 hover:scale-105'}`}
                                >
                                    <span className="flex items-center gap-1.5">
                                        ∞ Todo
                                    </span>
                                </button>
                                <button
                                    onClick={() => setDateFilter('custom')}
                                    className={`group px-4 py-2 rounded-xl text-xs font-black transition-all duration-300 ${dateFilter === 'custom' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/40 scale-105' : 'text-slate-600 hover:bg-white/80 hover:text-violet-600 hover:scale-105'}`}
                                >
                                    <span className="flex items-center gap-1.5">
                                        📅 FECHA
                                    </span>
                                </button>
                            </div>

                            {/* Custom Date Inputs - Absolute positioned dropdown */}
                            <AnimatePresence>
                                {dateFilter === 'custom' && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        className="absolute top-full mt-2 right-0 z-50"
                                    >
                                        <div className="bg-white/95 backdrop-blur-xl rounded-2xl border-2 border-violet-300/60 shadow-2xl shadow-violet-200/40 p-3 flex items-center gap-3">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wide">Desde</span>
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-[140px] px-3 py-2 rounded-xl border-2 border-violet-200 text-xs font-bold text-slate-700 bg-white focus:border-violet-400 focus:outline-none transition-all"
                                                />
                                            </div>
                                            <span className="text-violet-400 text-lg font-black pt-4">→</span>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wide">Hasta</span>
                                                <input
                                                    type="date"
                                                    value={endDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    className="w-[140px] px-3 py-2 rounded-xl border-2 border-violet-200 text-xs font-bold text-slate-700 bg-white focus:border-violet-400 focus:outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
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

                    {/* Mobile Date Filter */}
                    <div className="lg:hidden mt-3 px-4">
                        <div className="bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-xl rounded-2xl border border-white/60 shadow-lg p-2">
                            <div className="grid grid-cols-4 gap-1.5 mb-2">
                                <button
                                    onClick={() => setDateFilter('today')}
                                    className={`py-2.5 rounded-xl text-[10px] font-black transition-all duration-300 ${dateFilter === 'today' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md' : 'bg-slate-50 text-slate-600'}`}
                                >
                                    ⚡ Hoy
                                </button>
                                <button
                                    onClick={() => setDateFilter('week')}
                                    className={`py-2.5 rounded-xl text-[10px] font-black transition-all duration-300 ${dateFilter === 'week' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md' : 'bg-slate-50 text-slate-600'}`}
                                >
                                    📊 7d
                                </button>
                                <button
                                    onClick={() => setDateFilter('all')}
                                    className={`py-2.5 rounded-xl text-[10px] font-black transition-all duration-300 ${dateFilter === 'all' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md' : 'bg-slate-50 text-slate-600'}`}
                                >
                                    ∞ Todo
                                </button>
                                <button
                                    onClick={() => setDateFilter('custom')}
                                    className={`py-2.5 rounded-xl text-[10px] font-black transition-all duration-300 ${dateFilter === 'custom' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md' : 'bg-slate-50 text-slate-600'}`}
                                >
                                    📅
                                </button>
                            </div>

                            {/* Mobile Custom Date Inputs */}
                            <AnimatePresence>
                                {dateFilter === 'custom' && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="px-2 py-2 rounded-xl border-2 border-violet-200 text-[10px] font-bold text-slate-700 bg-white focus:border-violet-400 focus:outline-none"
                                            />
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="px-2 py-2 rounded-xl border-2 border-violet-200 text-[10px] font-bold text-slate-700 bg-white focus:border-violet-400 focus:outline-none"
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
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

            {/* --- MAIN CONTENT --- */}
            <div className="max-w-screen-2xl mx-auto p-4 md:p-8 relative z-10">

                {/* Desktop Tabs */}
                <div className="hidden md:flex justify-start mb-6">
                    <div className="bg-slate-100/50 p-1 rounded-2xl flex gap-1">
                        {tabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${isActive ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'}`}
                                >
                                    {tab.id === 'pending' && <Flame size={16} className={isActive ? 'text-amber-500' : ''} />}
                                    {tab.id === 'preparing' && <ChefHat size={16} className={isActive ? 'text-blue-500' : ''} />}
                                    {tab.id === 'completed' && <CheckCircle size={16} className={isActive ? 'text-green-500' : ''} />}
                                    {tab.label}
                                    {tab.count > 0 && (
                                        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'}`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Desktop Content Area (Single Column based on Tab) */}
                <div className="hidden md:block h-[calc(100vh-220px)]">
                    <AnimatePresence mode='wait'>
                        {/* PENDING TAB */}
                        {activeTab === 'pending' && (
                            <motion.div
                                key="pending"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="h-full flex flex-col bg-slate-50/50 rounded-3xl border-2 border-slate-200/60 overflow-hidden shadow-sm"
                            >
                                <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2"><Flame size={14} className="text-amber-500" /> Por Aceptar</h3>
                                    <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded text-xs">{pendingCount}</span>
                                </div>
                                <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 content-start">
                                    <AnimatePresence mode='popLayout'>
                                        {orders.filter(o => o.status === 'pending').map(order => (
                                            <div key={order.id} className="w-full">
                                                <OrderCardUltra order={order} updateStatus={updateStatus} />
                                            </div>
                                        ))}
                                    </AnimatePresence>
                                    {pendingCount === 0 && <div className="col-span-full"><EmptyStateUltra /></div>}
                                </div>
                            </motion.div>
                        )}

                        {/* PREPARING TAB */}
                        {activeTab === 'preparing' && (
                            <motion.div
                                key="preparing"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="h-full flex flex-col bg-blue-50/30 rounded-3xl border-2 border-blue-100/50 overflow-hidden shadow-sm"
                            >
                                <div className="p-4 bg-white border-b border-blue-100 flex justify-between items-center">
                                    <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2"><ChefHat size={14} className="text-blue-500" /> Cocinando</h3>
                                    <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-xs">{preparingCount}</span>
                                </div>
                                <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 content-start">
                                    <AnimatePresence mode='popLayout'>
                                        {orders.filter(o => o.status === 'preparing').map(order => (
                                            <div key={order.id} className="w-full">
                                                <OrderCardUltra order={order} updateStatus={updateStatus} />
                                            </div>
                                        ))}
                                    </AnimatePresence>
                                    {preparingCount === 0 && <div className="col-span-full"><EmptyStateUltra /></div>}
                                </div>
                            </motion.div>
                        )}

                        {/* COMPLETED TAB */}
                        {activeTab === 'completed' && (
                            <motion.div
                                key="completed"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="h-full flex flex-col bg-green-50/30 rounded-3xl border-2 border-green-100/50 overflow-hidden shadow-sm"
                            >
                                <div className="p-4 bg-white border-b border-green-100 flex justify-between items-center">
                                    <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2"><CheckCircle size={14} className="text-green-500" /> Resumen</h3>
                                    <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded text-xs">{completedCount}</span>
                                </div>
                                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                        <AnimatePresence mode='popLayout'>
                                            {orders.filter(o => o.status === 'completed').map(order => (
                                                <CompactOrderCard key={order.id} order={order} />
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                    {completedCount === 0 && <EmptyStateUltra />}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Mobile Layout (Styled Container) */}
                <div className="md:hidden h-[calc(100vh-240px)]">
                    <AnimatePresence mode='wait'>
                        {/* PENDING MOBILE */}
                        {activeTab === 'pending' && (
                            <motion.div
                                key="pending-mobile"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="h-full flex flex-col bg-slate-50/50 rounded-3xl border-2 border-slate-200/60 overflow-hidden shadow-sm"
                            >
                                <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2"><Flame size={14} className="text-amber-500" /> Pendientes</h3>
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
                            </motion.div>
                        )}

                        {/* PREPARING MOBILE */}
                        {activeTab === 'preparing' && (
                            <motion.div
                                key="preparing-mobile"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="h-full flex flex-col bg-blue-50/30 rounded-3xl border-2 border-blue-100/50 overflow-hidden shadow-sm"
                            >
                                <div className="p-4 bg-white border-b border-blue-100 flex justify-between items-center">
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
                            </motion.div>
                        )}

                        {/* COMPLETED MOBILE */}
                        {activeTab === 'completed' && (
                            <motion.div
                                key="completed-mobile"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="h-full flex flex-col bg-green-50/30 rounded-3xl border-2 border-green-100/50 overflow-hidden shadow-sm"
                            >
                                <div className="p-4 bg-white border-b border-green-100 flex justify-between items-center">
                                    <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2"><CheckCircle size={14} className="text-green-500" /> Entregados</h3>
                                    <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded text-xs">{completedCount}</span>
                                </div>
                                <div className="p-4 overflow-y-auto space-y-4 custom-scrollbar flex-1">
                                    <AnimatePresence mode='popLayout'>
                                        {orders.filter(o => o.status === 'completed').map(order => (
                                            <CompactOrderCard key={order.id} order={order} mobile />
                                        ))}
                                    </AnimatePresence>
                                    {completedCount === 0 && <EmptyStateUltra />}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
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
    const [isExpanded, setIsExpanded] = useState(false);

    // Status Logic
    const isPending = order.status === 'pending';
    const isPreparing = order.status === 'preparing';

    // Timer Style
    let timerStyle = 'text-slate-400 bg-slate-50 border-slate-100';
    let timerGlow = '';
    if (isPending) {
        if (elapsed > 10) {
            timerStyle = 'text-white bg-gradient-to-r from-red-500 to-rose-600 border-red-400 shadow-lg shadow-red-500/50';
            timerGlow = 'animate-pulse';
        } else if (elapsed > 5) {
            timerStyle = 'text-white bg-gradient-to-r from-amber-500 to-orange-500 border-amber-400 shadow-md shadow-amber-500/30';
        }
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="group relative bg-gradient-to-br from-white via-white to-slate-50/30 rounded-2xl shadow-md border border-slate-200/60 hover:shadow-xl hover:shadow-slate-300/30 transition-all duration-300 overflow-hidden"
        >
            {/* Ambient Glow Effect */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none bg-gradient-to-tr ${isPending ? 'from-amber-500/5 via-orange-500/3 to-transparent' : isPreparing ? 'from-blue-500/5 via-indigo-500/3 to-transparent' : 'from-green-500/5 via-emerald-500/3 to-transparent'}`} />

            {/* Urgent Order Alert Glow */}
            {elapsed > 10 && isPending && (
                <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20 rounded-2xl blur-lg animate-pulse -z-10" />
            )}

            {/* Compact Header - Always Visible */}
            <div
                className="p-4 cursor-pointer relative z-10"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between gap-3">
                    {/* Left: Order Info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isPending ? 'bg-amber-100' : isPreparing ? 'bg-blue-100' : 'bg-green-100'}`}>
                                {order.delivery_method === 'pickup' ? (
                                    <ShoppingBag size={20} className={isPending ? 'text-amber-600' : isPreparing ? 'text-blue-600' : 'text-green-600'} />
                                ) : (
                                    <MapPin size={20} className={isPending ? 'text-amber-600' : isPreparing ? 'text-blue-600' : 'text-green-600'} />
                                )}
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-black text-lg text-slate-800 truncate">{order.customer_name}</h3>
                                <span className="text-xs font-mono text-slate-400">#{order.id}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="font-semibold">{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</span>
                                <span>•</span>
                                <span className="font-mono font-bold text-slate-700">${order.total}</span>
                                <span>•</span>
                                <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Timer & Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${timerStyle} ${timerGlow}`}>
                            <Timer size={12} />
                            <span className="tabular-nums">{elapsed}m</span>
                        </div>

                        <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-slate-400"
                        >
                            <ChevronDown size={20} />
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Expandable Details */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                            {/* Payment Info */}
                            {order.payment_method && (
                                <div className="mt-3 mb-3">
                                    <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border inline-flex items-center gap-1.5 ${order.payment_method === 'card' && order.payment_status === 'paid' ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                        {order.payment_method === 'card' ? '💳 PAGADO (Stripe)' : '💵 EFECTIVO / TRANSFER'}
                                    </span>
                                </div>
                            )}

                            {/* Order Items - Detailed */}
                            <div className="space-y-3 mb-4">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Detalles del Pedido</h4>
                                {order.items.map((item: any, i) => (
                                    <div key={i} className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                                                {i + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h5 className="font-black text-slate-800 mb-2">
                                                    {item.name || (item.productType === 'bowl' ? '🍱 Poke Bowl' : '🍔 Sushi Burger')}
                                                </h5>

                                                {/* Base */}
                                                {item.base && (
                                                    <div className="mb-2">
                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Base:</span>
                                                        <p className="text-sm text-slate-700 font-semibold mt-0.5">{item.base.name}</p>
                                                    </div>
                                                )}

                                                {/* Proteins */}
                                                {item.proteins && item.proteins.length > 0 && (
                                                    <div className="mb-2">
                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Proteínas:</span>
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {item.proteins.map((p: any, idx: number) => (
                                                                <span key={idx} className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-lg font-bold border border-rose-200">
                                                                    {p.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Mixins */}
                                                {item.mixins && item.mixins.length > 0 && (
                                                    <div className="mb-2">
                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mix-ins:</span>
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {item.mixins.map((m: any, idx: number) => (
                                                                <span key={idx} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-bold border border-green-200">
                                                                    {m.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Toppings */}
                                                {item.toppings && item.toppings.length > 0 && (
                                                    <div className="mb-2">
                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Toppings:</span>
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {item.toppings.map((t: any, idx: number) => (
                                                                <span key={idx} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-bold border border-amber-200">
                                                                    {t.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Sauce */}
                                                {item.sauce && (
                                                    <div className="mb-2">
                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Salsa:</span>
                                                        <p className="text-sm text-slate-700 font-semibold mt-0.5">{item.sauce.name}</p>
                                                    </div>
                                                )}

                                                {/* Extras */}
                                                {item.extras && item.extras.length > 0 && (
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Extras:</span>
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {item.extras.map((e: any, idx: number) => (
                                                                <span key={idx} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-lg font-bold border border-purple-200">
                                                                    {e.name}
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

                            {/* Customer Info */}
                            {(order.phone || order.address) && (
                                <div className="mb-4 p-3 bg-white rounded-xl border border-slate-200">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Información de Contacto</h4>
                                    {order.phone && (
                                        <p className="text-sm text-slate-700 mb-1">
                                            <span className="font-bold">Tel:</span> {order.phone}
                                        </p>
                                    )}
                                    {order.address && order.delivery_method === 'delivery' && (
                                        <p className="text-sm text-slate-700">
                                            <span className="font-bold">Dirección:</span> {order.address}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-0.5">Total</span>
                                    <span className="text-2xl font-black text-slate-900 font-mono">${order.total}</span>
                                </div>

                                <div className="flex gap-2">
                                    {isPending && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'preparing'); }}
                                            className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white pl-4 pr-5 py-3 rounded-xl text-xs font-black shadow-xl shadow-slate-900/30 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2 overflow-hidden group/btn"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-rose-500/20 to-orange-500/0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
                                            <div className="relative flex items-center gap-2">
                                                <Flame size={16} className="text-rose-400 drop-shadow-lg" />
                                                <span className="relative z-10">COCINAR</span>
                                            </div>
                                        </button>
                                    )}
                                    {isPreparing && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'completed'); }}
                                            className="bg-gradient-to-r from-indigo-500 via-blue-600 to-indigo-600 text-white px-5 py-3 rounded-xl text-xs font-black shadow-xl shadow-indigo-500/40 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2"
                                        >
                                            <CheckCircle size={16} className="drop-shadow-md" />
                                            <span>Listo</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
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
