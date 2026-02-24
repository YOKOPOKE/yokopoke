"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Search, Phone, Clock, ChevronLeft, RefreshCw,
    User, Bot, ShoppingCart, Pause, MessageCircle,
    Package, Check, CheckCheck, ShoppingBag, DollarSign,
    Users, MessageSquare, ArrowUpRight, Activity, Send
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
    orderCount: number;
    totalSpent: number;
}

// --- Helpers ---
function getTimeAgo(dateStr: string): string {
    const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    return `hace ${Math.round(hrs / 24)}d`;
}

function formatTime(timestamp?: number): string {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function getModeConfig(mode: string) {
    switch (mode) {
        case 'CHECKOUT': return { label: 'En checkout', color: 'text-amber-600', bg: 'bg-amber-400', ring: 'ring-amber-400' };
        case 'PAUSED': return { label: 'Bot pausado', color: 'text-red-500', bg: 'bg-red-400', ring: 'ring-red-400' };
        case 'BUILDER': return { label: 'Armando pedido', color: 'text-violet-600', bg: 'bg-violet-400', ring: 'ring-violet-400' };
        default: return { label: 'En línea', color: 'text-emerald-600', bg: 'bg-emerald-400', ring: 'ring-emerald-400' };
    }
}

export default function CRMPage() {
    const [sessions, setSessions] = useState<CustomerData[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChat, setSelectedChat] = useState<CustomerData | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Stats
    const [stats, setStats] = useState({ chats: 0, orders: 0, revenue: 0, pending: 0 });

    const fetchData = async () => {
        // Fetch sessions
        const { data: sessionsData } = await supabase
            .from('whatsapp_sessions')
            .select('phone, state, updated_at')
            .order('updated_at', { ascending: false })
            .limit(50);

        // Fetch today's orders
        const now = new Date();
        const startOfDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`;
        const { data: ordersData } = await supabase
            .from('orders')
            .select('id, customer_name, total, status, delivery_method, created_at, phone, customer_phone')
            .gte('created_at', startOfDay)
            .order('created_at', { ascending: false });

        if (ordersData) setOrders(ordersData);

        if (sessionsData) {
            const allOrders = ordersData || [];
            const parsed: CustomerData[] = sessionsData
                .filter((s: ChatSession) => s.state?.conversationHistory?.length > 0)
                .map((s: ChatSession) => {
                    const state = s.state;
                    const history = state.conversationHistory || [];
                    const lastMsg = history[history.length - 1];
                    const name = state?.customerProfile?.name || state?.checkoutState?.customerName || 'Cliente';
                    const mode = state?.mode || 'NORMAL';
                    const phone10 = s.phone.slice(-10);
                    const custOrders = allOrders.filter((o: any) =>
                        o.phone?.includes(phone10) || o.customer_phone?.includes(phone10)
                    );

                    return {
                        name,
                        phone: s.phone,
                        shortPhone: s.phone.length > 6 ? s.phone.slice(-10) : s.phone,
                        mode,
                        lastMessage: lastMsg?.text?.replace(/\*/g, '').substring(0, 60) || '',
                        lastMessageTime: s.updated_at,
                        messageCount: history.length,
                        timeAgo: getTimeAgo(s.updated_at),
                        history,
                        profile: state?.customerProfile || {},
                        orderCount: custOrders.length,
                        totalSpent: custOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0)
                    };
                });
            setSessions(parsed);

            // Update selected chat if it exists
            if (selectedChat) {
                const updated = parsed.find(s => s.phone === selectedChat.phone);
                if (updated) setSelectedChat(updated);
            }

            // Stats
            const valid = (ordersData || []).filter((o: any) => o.status !== 'cancelled');
            setStats({
                chats: parsed.length,
                orders: valid.length,
                revenue: valid.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0),
                pending: (ordersData || []).filter((o: any) => ['pending', 'preparing', 'confirmed'].includes(o.status)).length
            });
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        const ordersChannel = supabase.channel('crm-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
            .subscribe();
        const sessionsChannel = supabase.channel('crm-sessions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_sessions' }, () => fetchData())
            .subscribe();
        const interval = setInterval(fetchData, 30000);
        return () => {
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(sessionsChannel);
            clearInterval(interval);
        };
    }, []);

    // Scroll to bottom when chat changes
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [selectedChat]);

    const filteredSessions = sessions.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone.includes(searchTerm)
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <MessageCircle size={28} className="text-white" />
                    </div>
                    <p className="text-slate-400 font-bold">Cargando CRM...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] flex flex-col">
            {/* Top Stats Mini-Bar */}
            <div className="flex items-center gap-3 mb-3 overflow-x-auto pb-1">
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm flex-shrink-0">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-xs font-black text-slate-800">{stats.chats}</span>
                    <span className="text-[10px] font-bold text-slate-400">chats</span>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm flex-shrink-0">
                    <ShoppingBag size={12} className="text-amber-500" />
                    <span className="text-xs font-black text-slate-800">{stats.orders}</span>
                    <span className="text-[10px] font-bold text-slate-400">pedidos</span>
                    {stats.pending > 0 && <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{stats.pending} activos</span>}
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm flex-shrink-0">
                    <DollarSign size={12} className="text-emerald-500" />
                    <span className="text-xs font-black text-emerald-700">${stats.revenue.toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-slate-400">hoy</span>
                </div>
            </div>

            {/* Main WhatsApp Layout */}
            <div className="flex-1 bg-white rounded-[1.5rem] border border-slate-200 shadow-lg overflow-hidden flex min-h-0">

                {/* LEFT: Conversation List */}
                <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[380px] md:min-w-[380px] border-r border-slate-200`}>
                    {/* Header */}
                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
                                <MessageCircle size={18} className="text-white" />
                            </div>
                            <div>
                                <h2 className="font-black text-white text-sm">Yoko CRM</h2>
                                <p className="text-[10px] text-slate-400 font-medium">{sessions.length} conversaciones</p>
                            </div>
                        </div>
                        <button onClick={fetchData} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <RefreshCw size={16} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar o empezar un chat"
                                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-emerald-400 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Chat List */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredSessions.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <MessageCircle size={36} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm font-medium">Sin conversaciones</p>
                            </div>
                        ) : (
                            filteredSessions.map((session) => {
                                const modeConfig = getModeConfig(session.mode);
                                const isSelected = selectedChat?.phone === session.phone;
                                const lastMsgRole = session.history[session.history.length - 1]?.role;

                                return (
                                    <div
                                        key={session.phone}
                                        onClick={() => setSelectedChat(session)}
                                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-slate-50 transition-colors ${isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                                    >
                                        {/* Avatar */}
                                        <div className="relative flex-shrink-0">
                                            <div className="w-12 h-12 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center font-black text-slate-600 text-base">
                                                {session.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className={`absolute bottom-0 right-0 w-3 h-3 ${modeConfig.bg} rounded-full border-2 border-white`} />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="font-bold text-slate-900 text-[15px] truncate">{session.name}</span>
                                                <span className={`text-[11px] font-medium flex-shrink-0 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`}>{session.timeAgo}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {lastMsgRole === 'bot' && (
                                                    <CheckCheck size={14} className="text-sky-500 flex-shrink-0" />
                                                )}
                                                <p className="text-[13px] text-slate-500 truncate">{session.lastMessage}</p>
                                            </div>
                                        </div>

                                        {/* Badges */}
                                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                            {session.mode === 'CHECKOUT' && (
                                                <span className="bg-amber-400 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">🛒</span>
                                            )}
                                            {session.mode === 'PAUSED' && (
                                                <span className="bg-red-400 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">⏸</span>
                                            )}
                                            {session.orderCount > 0 && (
                                                <span className="text-[9px] font-bold text-slate-400">{session.orderCount} 📦</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT: Chat View */}
                <div className={`${!selectedChat ? 'hidden md:flex' : 'flex'} flex-col flex-1 min-w-0`}>
                    {selectedChat ? (
                        <>
                            {/* Chat Header */}
                            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedChat(null)}
                                    className="md:hidden p-1.5 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <ChevronLeft size={20} className="text-white" />
                                </button>

                                <div className="relative">
                                    <div className="w-10 h-10 bg-gradient-to-br from-slate-500 to-slate-600 rounded-full flex items-center justify-center font-black text-white text-sm">
                                        {selectedChat.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${getModeConfig(selectedChat.mode).bg} rounded-full border-2 border-slate-800`} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-white text-sm truncate">{selectedChat.name}</h3>
                                    <p className={`text-[11px] font-medium ${getModeConfig(selectedChat.mode).color}`}>
                                        {getModeConfig(selectedChat.mode).label} · {selectedChat.shortPhone}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0">
                                    {selectedChat.totalSpent > 0 && (
                                        <div className="bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg text-[11px] font-black">
                                            ${selectedChat.totalSpent} gastado
                                        </div>
                                    )}
                                    {selectedChat.orderCount > 0 && (
                                        <div className="bg-white/10 text-slate-300 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                                            {selectedChat.orderCount} pedidos
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div
                                className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-1"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.3'%3E%3Cpath d='m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm-30 30v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                                    backgroundColor: '#f0f2f5'
                                }}
                            >
                                {/* Date separator */}
                                <div className="flex justify-center mb-3">
                                    <span className="bg-white text-slate-500 text-[11px] font-bold px-3 py-1 rounded-lg shadow-sm">
                                        Hoy
                                    </span>
                                </div>

                                {selectedChat.history.map((msg, idx) => {
                                    const isUser = msg.role === 'user';
                                    const time = formatTime(msg.timestamp);
                                    const text = msg.text.replace(/\*/g, '');

                                    return (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, y: 8, scale: 0.97 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            transition={{ delay: idx * 0.02 }}
                                            className={`flex ${isUser ? 'justify-start' : 'justify-end'} mb-0.5`}
                                        >
                                            <div
                                                className={`relative max-w-[85%] md:max-w-[65%] px-3 py-2 rounded-lg shadow-sm ${isUser
                                                        ? 'bg-white text-slate-800 rounded-tl-none'
                                                        : 'bg-emerald-100 text-slate-800 rounded-tr-none'
                                                    }`}
                                            >
                                                {/* Sender label */}
                                                {isUser && (
                                                    <p className="text-[11px] font-bold text-emerald-600 mb-0.5">{selectedChat.name}</p>
                                                )}
                                                {!isUser && (
                                                    <p className="text-[11px] font-bold text-violet-600 mb-0.5">🤖 Yoko Bot</p>
                                                )}

                                                {/* Message text */}
                                                <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{text}</p>

                                                {/* Time + checkmarks */}
                                                <div className={`flex items-center gap-1 mt-1 ${isUser ? 'justify-end' : 'justify-end'}`}>
                                                    <span className="text-[10px] text-slate-400">{time}</span>
                                                    {!isUser && <CheckCheck size={14} className="text-sky-500" />}
                                                </div>

                                                {/* WhatsApp-style tail */}
                                                <div
                                                    className={`absolute top-0 w-3 h-3 ${isUser
                                                            ? '-left-1.5 bg-white'
                                                            : '-right-1.5 bg-emerald-100'
                                                        }`}
                                                    style={{
                                                        clipPath: isUser
                                                            ? 'polygon(100% 0, 0 0, 100% 100%)'
                                                            : 'polygon(0 0, 100% 0, 0 100%)'
                                                    }}
                                                />
                                            </div>
                                        </motion.div>
                                    );
                                })}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Bottom Info Bar */}
                            <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center gap-3">
                                <div className="flex-1 flex items-center gap-2 bg-white rounded-full px-4 py-2.5 border border-slate-200">
                                    <MessageCircle size={16} className="text-slate-400" />
                                    <span className="text-sm text-slate-400 font-medium">Conversación de solo lectura</span>
                                </div>
                                {selectedChat.profile?.favorites?.length > 0 && (
                                    <div className="hidden md:flex items-center gap-1.5 bg-violet-50 text-violet-600 px-3 py-2 rounded-full text-[11px] font-bold border border-violet-100">
                                        ⭐ {selectedChat.profile.favorites.slice(0, 2).join(', ')}
                                    </div>
                                )}
                                {selectedChat.profile?.lastAddress && (
                                    <div className="hidden md:flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-2 rounded-full text-[11px] font-bold border border-blue-100 max-w-[200px] truncate">
                                        📍 {selectedChat.profile.lastAddress}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Empty State */
                        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white">
                            <div className="w-64 h-64 relative mb-6">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-teal-50 rounded-full opacity-50" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-200">
                                            <MessageCircle size={36} className="text-white" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2">Yoko CRM</h3>
                            <p className="text-slate-400 font-medium text-center max-w-xs text-sm">
                                Selecciona una conversación para ver el historial completo de chat con el cliente.
                            </p>
                            <div className="flex items-center gap-2 mt-6 text-[11px] font-bold text-slate-400">
                                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                En vivo — actualización automática
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
