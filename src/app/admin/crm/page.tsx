"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Search, Phone, ChevronLeft, RefreshCw,
    User, Bot, ShoppingCart, Pause, MessageCircle,
    Package, CheckCheck, Send, Play, PauseCircle,
    MoreVertical, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/context/ToastContext';

export const dynamic = 'force-dynamic';

// --- Types ---
interface ChatSession { phone: string; state: any; updated_at: string; }

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
    unread: number;
}

// --- Helpers ---
function getTimeAgo(dateStr: string): string {
    const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.round(mins / 60)}h`;
    return `${Math.round(mins / 1440)}d`;
}

function formatTime(timestamp?: number): string {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function getModeConfig(mode: string) {
    switch (mode) {
        case 'CHECKOUT': return { label: 'Checkout', dot: 'bg-amber-400' };
        case 'PAUSED': return { label: 'Pausado', dot: 'bg-red-400' };
        case 'BUILDER': return { label: 'Armando', dot: 'bg-violet-400' };
        default: return { label: 'En línea', dot: 'bg-emerald-400' };
    }
}

export default function CRMPage() {
    const [sessions, setSessions] = useState<CustomerData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChat, setSelectedChat] = useState<CustomerData | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [sending, setSending] = useState(false);
    const [showActions, setShowActions] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const fetchData = async () => {
        const { data: sessionsData } = await supabase
            .from('whatsapp_sessions')
            .select('phone, state, updated_at')
            .order('updated_at', { ascending: false })
            .limit(100);

        const now = new Date();
        const startOfDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`;
        const { data: ordersData } = await supabase
            .from('orders')
            .select('id, total, phone, customer_phone, status')
            .gte('created_at', startOfDay);

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

                    // Count "unread" = messages from user after last bot message
                    let unread = 0;
                    for (let i = history.length - 1; i >= 0; i--) {
                        if (history[i].role === 'user') unread++;
                        else break;
                    }

                    return {
                        name, phone: s.phone,
                        shortPhone: phone10.length === 10 ? `${phone10.slice(0, 3)} ${phone10.slice(3, 6)} ${phone10.slice(6)}` : phone10,
                        mode, lastMessage: lastMsg?.text?.replace(/\*/g, '').substring(0, 55) || '',
                        lastMessageTime: s.updated_at, messageCount: history.length,
                        timeAgo: getTimeAgo(s.updated_at), history,
                        profile: state?.customerProfile || {},
                        orderCount: custOrders.length,
                        totalSpent: custOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0),
                        unread
                    };
                });
            setSessions(parsed);

            if (selectedChat) {
                const updated = parsed.find(s => s.phone === selectedChat.phone);
                if (updated) setSelectedChat(updated);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        const ch1 = supabase.channel('crm-s').on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_sessions' }, () => fetchData()).subscribe();
        const ch2 = supabase.channel('crm-o').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData()).subscribe();
        const interval = setInterval(fetchData, 20000);
        return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); clearInterval(interval); };
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedChat?.history?.length]);

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !selectedChat || sending) return;
        const msg = messageInput.trim();
        setMessageInput('');
        setSending(true);

        try {
            const res = await fetch('/api/crm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send_message', phone: selectedChat.phone, message: msg })
            });
            const data = await res.json();
            if (data.success) {
                showToast('✅ Mensaje enviado', 'success');
                await fetchData();
            } else {
                showToast('❌ Error al enviar', 'error');
                setMessageInput(msg);
            }
        } catch {
            showToast('❌ Error de conexión', 'error');
            setMessageInput(msg);
        }
        setSending(false);
        inputRef.current?.focus();
    };

    const handlePauseResume = async (action: 'pause_bot' | 'resume_bot') => {
        if (!selectedChat) return;
        setShowActions(false);
        try {
            const res = await fetch('/api/crm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, phone: selectedChat.phone })
            });
            const data = await res.json();
            if (data.success) {
                showToast(action === 'pause_bot' ? '⏸ Bot pausado' : '▶️ Bot activado', 'success');
                await fetchData();
            }
        } catch { showToast('❌ Error', 'error'); }
    };

    const filtered = sessions.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone.includes(searchTerm)
    );

    if (loading) {
        return (
            <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center animate-pulse">
                    <MessageCircle size={24} className="text-white" />
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] flex flex-col -mt-4 md:-mt-4 -mx-4 md:-mx-8">
            {/* WhatsApp Container */}
            <div className="flex-1 flex overflow-hidden bg-white">

                {/* === LEFT PANEL: Chat List === */}
                <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[420px] md:min-w-[340px] border-r border-slate-200 bg-white`}>

                    {/* Header */}
                    <div className="bg-slate-100 px-4 py-3 flex items-center justify-between border-b border-slate-200">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                                <MessageCircle size={16} className="text-white" />
                            </div>
                            <span className="font-bold text-slate-800 text-lg">CRM</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-slate-400">{sessions.length} chats</span>
                            <button onClick={fetchData} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <RefreshCw size={16} className="text-slate-500" />
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="px-2 py-1.5 bg-slate-50">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar cliente..."
                                className="w-full bg-white rounded-lg pl-9 pr-3 py-[9px] text-[13px] text-slate-700 focus:outline-none border border-slate-200 focus:border-emerald-400"
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto">
                        {filtered.length === 0 && (
                            <div className="p-8 text-center text-slate-400 text-sm">Sin resultados</div>
                        )}
                        {filtered.map((s) => {
                            const active = selectedChat?.phone === s.phone;
                            const lastIsUser = s.history[s.history.length - 1]?.role === 'user';

                            return (
                                <div
                                    key={s.phone}
                                    onClick={() => { setSelectedChat(s); setShowActions(false); }}
                                    className={`flex items-center gap-3 px-3 py-[10px] cursor-pointer border-b border-slate-100/80 ${active ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                                >
                                    {/* Avatar */}
                                    <div className="relative flex-shrink-0">
                                        <div className="w-[50px] h-[50px] bg-gradient-to-br from-slate-300 to-slate-400 rounded-full flex items-center justify-center font-bold text-white text-lg">
                                            {s.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className={`absolute bottom-0.5 right-0.5 w-3 h-3 ${getModeConfig(s.mode).dot} rounded-full border-[2px] border-white`} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-[2px]">
                                            <span className="font-semibold text-slate-900 text-[15px] truncate">{s.name}</span>
                                            <span className={`text-[11px] flex-shrink-0 ${s.unread > 0 ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>{s.timeAgo}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1 min-w-0 flex-1">
                                                {!lastIsUser && <CheckCheck size={15} className="text-sky-400 flex-shrink-0" />}
                                                <p className="text-[13px] text-slate-500 truncate">{s.lastMessage}</p>
                                            </div>
                                            {s.unread > 0 && (
                                                <span className="bg-emerald-500 text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                                                    {s.unread}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* === RIGHT PANEL: Chat View === */}
                <div className={`${!selectedChat ? 'hidden md:flex' : 'flex'} flex-col flex-1 min-w-0`}>
                    {selectedChat ? (
                        <>
                            {/* Header */}
                            <div className="bg-slate-100 px-3 py-[10px] flex items-center gap-3 border-b border-slate-200">
                                <button onClick={() => setSelectedChat(null)} className="md:hidden p-1">
                                    <ChevronLeft size={22} className="text-slate-600" />
                                </button>
                                <div className="relative">
                                    <div className="w-10 h-10 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full flex items-center justify-center font-bold text-white text-sm">
                                        {selectedChat.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${getModeConfig(selectedChat.mode).dot} rounded-full border-2 border-slate-100`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-slate-900 text-[15px] truncate leading-tight">{selectedChat.name}</h3>
                                    <p className="text-[12px] text-slate-500 leading-tight">
                                        {selectedChat.shortPhone}
                                        {selectedChat.orderCount > 0 && ` · ${selectedChat.orderCount} pedidos`}
                                        {selectedChat.totalSpent > 0 && ` · $${selectedChat.totalSpent}`}
                                    </p>
                                </div>

                                {/* Actions Menu */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowActions(!showActions)}
                                        className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                                    >
                                        <MoreVertical size={18} className="text-slate-600" />
                                    </button>
                                    <AnimatePresence>
                                        {showActions && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-52 z-50"
                                            >
                                                {selectedChat.mode !== 'PAUSED' ? (
                                                    <button
                                                        onClick={() => handlePauseResume('pause_bot')}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left text-sm text-slate-700"
                                                    >
                                                        <PauseCircle size={16} className="text-red-500" />
                                                        Pausar bot (1h)
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handlePauseResume('resume_bot')}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left text-sm text-slate-700"
                                                    >
                                                        <Play size={16} className="text-emerald-500" />
                                                        Reanudar bot
                                                    </button>
                                                )}
                                                <div className="border-t border-slate-100 my-1" />
                                                <div className="px-4 py-2 text-[11px] text-slate-400 space-y-1">
                                                    <p className="flex items-center gap-1.5"><Phone size={10} /> {selectedChat.phone}</p>
                                                    <p className="flex items-center gap-1.5"><Clock size={10} /> {selectedChat.messageCount} mensajes</p>
                                                    {selectedChat.profile?.favorites?.length > 0 && (
                                                        <p>⭐ {selectedChat.profile.favorites.join(', ')}</p>
                                                    )}
                                                    {selectedChat.profile?.lastAddress && (
                                                        <p>📍 {selectedChat.profile.lastAddress}</p>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Messages */}
                            <div
                                className="flex-1 overflow-y-auto px-3 md:px-6 lg:px-16 py-3 space-y-[2px]"
                                style={{ backgroundColor: '#efeae2', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cdefs%3E%3Cpattern id='p' width='40' height='40' patternUnits='userSpaceOnUse'%3E%3Cpath d='M20 2L22 8L28 10L22 12L20 18L18 12L12 10L18 8Z' fill='%23d5ccbe' fill-opacity='0.15'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23p)'/%3E%3C/svg%3E")` }}
                                onClick={() => setShowActions(false)}
                            >
                                {/* Date chip */}
                                <div className="flex justify-center mb-2 sticky top-0 z-10">
                                    <span className="bg-white/90 backdrop-blur-sm text-slate-600 text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm">
                                        HOY
                                    </span>
                                </div>

                                {/* Paused banner */}
                                {selectedChat.mode === 'PAUSED' && (
                                    <div className="flex justify-center mb-2">
                                        <span className="bg-amber-100 text-amber-700 text-[11px] font-bold px-3 py-1 rounded-lg shadow-sm flex items-center gap-1.5">
                                            <PauseCircle size={12} /> Bot pausado — mensajes manuales
                                        </span>
                                    </div>
                                )}

                                {selectedChat.history.map((msg, idx) => {
                                    const isUser = msg.role === 'user';
                                    const time = formatTime(msg.timestamp);
                                    const isCRM = msg.text.startsWith('[CRM]');
                                    const text = msg.text.replace(/\*/g, '').replace(/^\[CRM\]\s*/, '');

                                    return (
                                        <div key={idx} className={`flex ${isUser ? 'justify-start' : 'justify-end'} mb-[1px]`}>
                                            <div
                                                className={`relative max-w-[85%] md:max-w-[60%] px-[9px] pt-[6px] pb-[7px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${isUser
                                                        ? 'bg-white rounded-lg rounded-tl-none'
                                                        : isCRM
                                                            ? 'bg-violet-100 rounded-lg rounded-tr-none'
                                                            : 'bg-[#d9fdd3] rounded-lg rounded-tr-none'
                                                    }`}
                                            >
                                                {/* CRM label */}
                                                {isCRM && (
                                                    <p className="text-[10px] font-bold text-violet-600 mb-0.5 flex items-center gap-1">
                                                        <User size={9} /> Mensaje manual
                                                    </p>
                                                )}

                                                {/* Text */}
                                                <p className="text-[13.5px] text-slate-900 leading-[19px] whitespace-pre-wrap break-words">
                                                    {text}
                                                    {/* Spacer for time */}
                                                    <span className="inline-block w-16" />
                                                </p>

                                                {/* Time + checks */}
                                                <span className="float-right -mt-4 text-[10px] text-slate-500/70 flex items-center gap-0.5 relative z-10">
                                                    {time}
                                                    {!isUser && <CheckCheck size={15} className="text-sky-400 ml-0.5" />}
                                                </span>

                                                {/* Tail */}
                                                <div
                                                    className={`absolute top-0 w-2 h-3 ${isUser ? '-left-2 text-white' : isCRM ? '-right-2 text-violet-100' : '-right-2 text-[#d9fdd3]'
                                                        }`}
                                                >
                                                    <svg viewBox="0 0 8 13" width="8" height="13">
                                                        {isUser ? (
                                                            <path fill="currentColor" d="M1.533 3.568L8 12.193V1H0l1.533 2.568z" />
                                                        ) : (
                                                            <path fill="currentColor" d="M6.467 3.568L0 12.193V1h8L6.467 3.568z" />
                                                        )}
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Message Input */}
                            <div className="bg-slate-100 px-3 py-2 flex items-end gap-2 border-t border-slate-200">
                                <div className="flex-1 bg-white rounded-3xl border border-slate-200 flex items-end px-4 py-2 min-h-[44px]">
                                    <input
                                        ref={inputRef}
                                        value={messageInput}
                                        onChange={e => setMessageInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                        placeholder="Escribe un mensaje al cliente..."
                                        className="flex-1 text-[14px] text-slate-800 bg-transparent focus:outline-none placeholder:text-slate-400"
                                        disabled={sending}
                                    />
                                </div>
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!messageInput.trim() || sending}
                                    className={`w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all flex-shrink-0 ${messageInput.trim() && !sending
                                            ? 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-200'
                                            : 'bg-slate-300'
                                        }`}
                                >
                                    <Send size={18} className="text-white ml-0.5" />
                                </button>
                            </div>
                        </>
                    ) : (
                        /* Empty State */
                        <div className="flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: '#f0ebe3' }}>
                            <div className="relative mb-8">
                                <div className="w-48 h-48 border-[6px] border-slate-200/50 rounded-full flex items-center justify-center">
                                    <div className="w-28 h-28 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center">
                                        <MessageCircle size={44} className="text-emerald-400" />
                                    </div>
                                </div>
                            </div>
                            <h3 className="text-2xl font-light text-slate-700 mb-2">Yoko CRM</h3>
                            <p className="text-slate-400 text-sm text-center max-w-sm leading-relaxed">
                                Envía y recibe mensajes de WhatsApp, pausa el bot cuando necesites atender manualmente, y ve el historial completo de cada cliente.
                            </p>
                            <div className="flex items-center gap-2 mt-6 text-[11px] text-slate-400">
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                Actualización en tiempo real
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
