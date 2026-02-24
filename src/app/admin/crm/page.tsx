"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
    MessageSquare, Users, TrendingUp, ShoppingBag,
    Search, Phone, Clock, ChevronRight, RefreshCw,
    User, Bot, ShoppingCart, Pause, MessageCircle,
    ArrowUpRight, Package, DollarSign, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const dynamic = 'force-dynamic';

// --- Types ---
interface ChatSession {
    phone: string;
    state: any;
    updated_at: string;
}

interface CustomerData {
    name: string;
    phone: string;
    shortPhone: string;
    mode: string;
    lastMessage: string;
    lastMessageTime: string;
    messageCount: number;
    timeAgo: string;
    history: Array<{ role: string; text: string; timestamp?: number }>;
    profile: any;
}

interface OrderStats {
    totalToday: number;
    revenue: number;
    completed: number;
    pending: number;
    avgTicket: number;
    deliveries: number;
    pickups: number;
}

// --- Helpers ---
function getTimeAgo(dateStr: string): string {
    const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.round(hrs / 24)}d`;
}

function getModeConfig(mode: string) {
    switch (mode) {
        case 'CHECKOUT': return { label: 'Checkout', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <ShoppingCart size={12} />, dot: 'bg-amber-400' };
        case 'PAUSED': return { label: 'Pausado', color: 'bg-red-100 text-red-600 border-red-200', icon: <Pause size={12} />, dot: 'bg-red-400' };
        case 'BUILDER': return { label: 'Builder', color: 'bg-violet-100 text-violet-600 border-violet-200', icon: <Package size={12} />, dot: 'bg-violet-400' };
        default: return { label: 'Activo', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <MessageCircle size={12} />, dot: 'bg-emerald-400' };
    }
}

export default function CRMPage() {
    const [sessions, setSessions] = useState<CustomerData[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [stats, setStats] = useState<OrderStats>({ totalToday: 0, revenue: 0, completed: 0, pending: 0, avgTicket: 0, deliveries: 0, pickups: 0 });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChat, setSelectedChat] = useState<CustomerData | null>(null);
    const [mobileTab, setMobileTab] = useState<'chats' | 'customers' | 'stats'>('chats');
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        setRefreshing(true);

        // Fetch sessions
        const { data: sessionsData } = await supabase
            .from('whatsapp_sessions')
            .select('phone, state, updated_at')
            .order('updated_at', { ascending: false })
            .limit(50);

        if (sessionsData) {
            const parsed: CustomerData[] = sessionsData
                .filter((s: ChatSession) => s.state?.conversationHistory?.length > 0)
                .map((s: ChatSession) => {
                    const state = s.state;
                    const history = state.conversationHistory || [];
                    const lastMsg = history[history.length - 1];
                    const name = state?.customerProfile?.name || state?.checkoutState?.customerName || 'Cliente';
                    const mode = state?.mode || 'NORMAL';

                    return {
                        name,
                        phone: s.phone,
                        shortPhone: s.phone.length > 6 ? '...' + s.phone.slice(-4) : s.phone,
                        mode,
                        lastMessage: lastMsg?.text?.replace(/\*/g, '').substring(0, 80) || '',
                        lastMessageTime: s.updated_at,
                        messageCount: history.length,
                        timeAgo: getTimeAgo(s.updated_at),
                        history,
                        profile: state?.customerProfile || {}
                    };
                });
            setSessions(parsed);
        }

        // Fetch today's orders
        const now = new Date();
        const startOfDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`;

        const { data: ordersData } = await supabase
            .from('orders')
            .select('id, customer_name, total, status, delivery_method, created_at, items, phone, customer_phone, address')
            .gte('created_at', startOfDay)
            .order('created_at', { ascending: false });

        if (ordersData) {
            setOrders(ordersData);
            const valid = ordersData.filter((o: any) => o.status !== 'cancelled');
            const revenue = valid.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
            setStats({
                totalToday: valid.length,
                revenue,
                completed: ordersData.filter((o: any) => o.status === 'completed').length,
                pending: ordersData.filter((o: any) => ['pending', 'preparing', 'confirmed', 'out_for_delivery'].includes(o.status)).length,
                avgTicket: valid.length > 0 ? Math.round(revenue / valid.length) : 0,
                deliveries: valid.filter((o: any) => o.delivery_method === 'delivery').length,
                pickups: valid.filter((o: any) => o.delivery_method !== 'delivery').length
            });
        }

        setLoading(false);
        setRefreshing(false);
    };

    useEffect(() => {
        fetchData();

        // Real-time subscriptions
        const ordersChannel = supabase.channel('crm-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
            .subscribe();

        const sessionsChannel = supabase.channel('crm-sessions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_sessions' }, () => fetchData())
            .subscribe();

        // Auto-refresh every 30s
        const interval = setInterval(fetchData, 30000);

        return () => {
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(sessionsChannel);
            clearInterval(interval);
        };
    }, []);

    // Filter
    const filteredSessions = sessions.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone.includes(searchTerm)
    );

    // Unique customers (by phone) for customer panel
    const uniqueCustomers = sessions.reduce((acc, s) => {
        if (!acc.find(c => c.phone === s.phone)) acc.push(s);
        return acc;
    }, [] as CustomerData[]);

    const filteredCustomers = uniqueCustomers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm)
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Activity size={28} className="text-white" />
                    </div>
                    <p className="text-slate-400 font-bold">Cargando CRM...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <div>
                    <h5 className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mb-1">Centro de Control</h5>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-none">
                        CRM <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">en Vivo</span>
                    </h1>
                </div>
                <button
                    onClick={fetchData}
                    disabled={refreshing}
                    className={`flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-600 hover:border-violet-300 hover:text-violet-600 transition-all shadow-sm ${refreshing ? 'opacity-50' : ''}`}
                >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    Actualizar
                </button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                <StatsCard
                    icon={<MessageSquare size={20} />}
                    label="Chats Activos"
                    value={sessions.length.toString()}
                    accent="from-violet-500 to-indigo-500"
                    sub={`${sessions.filter(s => s.mode === 'CHECKOUT').length} en checkout`}
                />
                <StatsCard
                    icon={<ShoppingBag size={20} />}
                    label="Pedidos Hoy"
                    value={stats.totalToday.toString()}
                    accent="from-amber-500 to-orange-500"
                    sub={`${stats.pending} activos · ${stats.completed} listos`}
                />
                <StatsCard
                    icon={<DollarSign size={20} />}
                    label="Ventas Hoy"
                    value={`$${stats.revenue.toLocaleString()}`}
                    accent="from-emerald-500 to-green-500"
                    sub={`Ticket prom: $${stats.avgTicket}`}
                />
                <StatsCard
                    icon={<Users size={20} />}
                    label="Clientes"
                    value={uniqueCustomers.length.toString()}
                    accent="from-rose-500 to-pink-500"
                    sub={`${stats.deliveries} delivery · ${stats.pickups} pickup`}
                />
            </div>

            {/* Mobile Tab System */}
            <div className="md:hidden flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm mb-4">
                {[
                    { key: 'chats', label: '💬 Chats', count: sessions.length },
                    { key: 'customers', label: '👥 Clientes', count: uniqueCustomers.length },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setMobileTab(tab.key as any)}
                        className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${mobileTab === tab.key ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}
                    >
                        {tab.label}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${mobileTab === tab.key ? 'bg-white/20' : 'bg-slate-100'}`}>{tab.count}</span>
                    </button>
                ))}
            </div>

            {/* Search Bar */}
            <div className="relative mb-4">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre o teléfono..."
                    className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3.5 font-medium text-slate-700 focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 transition-all shadow-sm"
                />
            </div>

            {/* Main Grid: Chat Feed + Customers */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">

                {/* Chat Feed Panel */}
                <div className={`md:col-span-7 ${mobileTab !== 'chats' ? 'hidden md:block' : ''}`}>
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-200">
                                    <MessageSquare size={18} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900">Conversaciones</h3>
                                    <p className="text-[11px] font-bold text-slate-400">{filteredSessions.length} chats con historial</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">En Vivo</span>
                            </div>
                        </div>

                        <div className="divide-y divide-slate-50 max-h-[70vh] overflow-y-auto">
                            {filteredSessions.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
                                    <p className="font-bold">Sin conversaciones</p>
                                </div>
                            ) : (
                                filteredSessions.map((session, i) => {
                                    const modeConfig = getModeConfig(session.mode);
                                    return (
                                        <motion.div
                                            key={session.phone}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            onClick={() => setSelectedChat(selectedChat?.phone === session.phone ? null : session)}
                                            className={`p-4 hover:bg-slate-50/80 cursor-pointer transition-all group ${selectedChat?.phone === session.phone ? 'bg-violet-50/50 border-l-4 border-violet-500' : ''}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Avatar */}
                                                <div className="relative flex-shrink-0">
                                                    <div className="w-11 h-11 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center font-black text-slate-500 text-sm">
                                                        {session.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${modeConfig.dot} rounded-full border-2 border-white`} />
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="font-black text-slate-800 text-sm truncate">{session.name}</span>
                                                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border flex items-center gap-1 flex-shrink-0 ${modeConfig.color}`}>
                                                                {modeConfig.icon} {modeConfig.label}
                                                            </span>
                                                        </div>
                                                        <span className="text-[11px] font-bold text-slate-400 flex-shrink-0">{session.timeAgo}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 truncate leading-relaxed">{session.lastMessage}</p>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                            <Phone size={10} /> {session.shortPhone}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                            <MessageCircle size={10} /> {session.messageCount} msgs
                                                        </span>
                                                    </div>
                                                </div>

                                                <ChevronRight size={16} className="text-slate-300 group-hover:text-violet-400 transition-colors flex-shrink-0 mt-1" />
                                            </div>

                                            {/* Expanded Chat View */}
                                            <AnimatePresence>
                                                {selectedChat?.phone === session.phone && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 max-h-[300px] overflow-y-auto">
                                                            {session.history.slice(-10).map((msg, idx) => (
                                                                <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? '' : 'flex-row-reverse'}`}>
                                                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-slate-100 text-slate-500' : 'bg-violet-100 text-violet-600'}`}>
                                                                        {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                                                                    </div>
                                                                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-slate-100 text-slate-700' : 'bg-violet-50 text-violet-800'}`}>
                                                                        {msg.text.replace(/\*/g, '').substring(0, 300)}
                                                                        {msg.text.length > 300 && '...'}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Customers Panel */}
                <div className={`md:col-span-5 space-y-4 ${mobileTab !== 'customers' ? 'hidden md:block' : ''}`}>
                    {/* Active Orders */}
                    {orders.filter(o => ['pending', 'preparing', 'confirmed', 'out_for_delivery'].includes(o.status)).length > 0 && (
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-100 flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
                                    <ShoppingBag size={18} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900">Pedidos Activos</h3>
                                    <p className="text-[11px] font-bold text-slate-400">{stats.pending} en proceso</p>
                                </div>
                            </div>
                            <div className="divide-y divide-slate-50 max-h-[35vh] overflow-y-auto">
                                {orders
                                    .filter(o => ['pending', 'preparing', 'confirmed', 'out_for_delivery'].includes(o.status))
                                    .map(order => {
                                        const statusConfig: Record<string, { label: string; color: string }> = {
                                            pending: { label: '⏳ Pendiente', color: 'bg-amber-50 text-amber-700' },
                                            confirmed: { label: '✅ Confirmado', color: 'bg-blue-50 text-blue-700' },
                                            preparing: { label: '🔥 Preparando', color: 'bg-orange-50 text-orange-700' },
                                            out_for_delivery: { label: '🚗 En camino', color: 'bg-violet-50 text-violet-700' },
                                        };
                                        const sc = statusConfig[order.status] || { label: order.status, color: 'bg-slate-50 text-slate-600' };

                                        return (
                                            <div key={order.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="font-black text-slate-800 text-sm">{order.customer_name || 'Cliente'}</span>
                                                    <span className="font-mono font-black text-slate-800">${order.total}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${sc.color}`}>{sc.label}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        {order.delivery_method === 'delivery' ? '🚗 Delivery' : '🏪 Pickup'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                        <Clock size={10} /> {getTimeAgo(order.created_at)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    )}

                    {/* Customer List */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-200">
                                <Users size={18} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900">Clientes Recientes</h3>
                                <p className="text-[11px] font-bold text-slate-400">{filteredCustomers.length} contactos</p>
                            </div>
                        </div>
                        <div className="divide-y divide-slate-50 max-h-[50vh] overflow-y-auto">
                            {filteredCustomers.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <Users size={40} className="mx-auto mb-3 opacity-30" />
                                    <p className="font-bold">Sin clientes</p>
                                </div>
                            ) : (
                                filteredCustomers.map((customer, i) => {
                                    const customerOrders = orders.filter(o =>
                                        o.phone?.includes(customer.phone.slice(-10)) ||
                                        o.customer_phone?.includes(customer.phone.slice(-10))
                                    );
                                    const totalSpent = customerOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);

                                    return (
                                        <motion.div
                                            key={customer.phone}
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                            onClick={() => setSelectedChat(selectedChat?.phone === customer.phone ? null : customer)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center font-black text-slate-500 text-sm flex-shrink-0">
                                                    {customer.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-black text-slate-800 text-sm truncate">{customer.name}</span>
                                                        {totalSpent > 0 && (
                                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex-shrink-0">
                                                                ${totalSpent}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                            <Phone size={10} /> {customer.shortPhone}
                                                        </span>
                                                        {customerOrders.length > 0 && (
                                                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                                <ShoppingBag size={10} /> {customerOrders.length} pedidos
                                                            </span>
                                                        )}
                                                        {customer.profile?.favorites?.length > 0 && (
                                                            <span className="text-[10px] font-bold text-violet-400 truncate">
                                                                ⭐ {customer.profile.favorites[0]}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <ArrowUpRight size={14} className="text-slate-300 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Stats Card Component ---
function StatsCard({ icon, label, value, accent, sub }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    accent: string;
    sub: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all group"
        >
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 bg-gradient-to-br ${accent} rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                    {icon}
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{label}</span>
            </div>
            <div className="font-black text-2xl md:text-3xl text-slate-900 mb-1">{value}</div>
            <p className="text-[11px] font-bold text-slate-400">{sub}</p>
        </motion.div>
    );
}
