"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Clock, CheckCircle, RefreshCw, User, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
type Order = {
    id: number;
    created_at: string;
    customer_name: string;
    total: number;
    status: 'pending' | 'preparing' | 'completed' | 'cancelled';
    delivery_method: 'delivery' | 'pickup';
    items: any[]; // JSON
};

export default function AdminOrdersPage() {
    const supabase = createClient();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOrders = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (data) setOrders(data as Order[]);
        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();

        // Realtime subscription
        const channel = supabase
            .channel('orders')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
                const newOrder = payload.new as Order;
                setOrders(prev => [newOrder, ...prev]);
                // Play sound (optional)
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const updateStatus = async (id: number, status: string) => {
        await supabase.from('orders').update({ status }).eq('id', id);
        fetchOrders(); // Refresh to be safe
    };

    const columns = {
        pending: { label: 'Pendientes', color: 'bg-yellow-50 text-yellow-600 border-yellow-200', icon: <Clock className="text-yellow-600" /> },
        preparing: { label: 'Preparando', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: <RefreshCw className="text-blue-600" /> },
        completed: { label: 'Listos/Entregados', color: 'bg-green-50 text-green-600 border-green-200', icon: <CheckCircle className="text-green-600" /> }
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col text-yoko-dark">
            <div className="flex justify-between items-center mb-6 px-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pedidos en Vivo</h1>
                    <p className="text-gray-500 text-sm">Gestiona el flujo de la cocina en tiempo real.</p>
                </div>
                <button
                    onClick={fetchOrders}
                    className="p-3 bg-white hover:bg-gray-50 rounded-full transition-colors border border-gray-200 shadow-sm"
                >
                    <RefreshCw size={20} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden pb-4">
                {(Object.entries(columns) as [keyof typeof columns, any][]).map(([status, config]) => (
                    <div key={status} className="flex flex-col bg-white rounded-3xl p-4 border border-gray-200 h-full shadow-lg shadow-gray-100">
                        <div className={`flex items-center gap-3 font-bold p-4 rounded-2xl mb-4 border ${config.color}`}>
                            {config.icon}
                            <span className="tracking-wide">{config.label}</span>
                            <span className="ml-auto bg-white/50 px-3 py-1 rounded-lg text-sm tabular-nums shadow-sm">
                                {orders.filter(o => o.status === status).length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            <AnimatePresence mode='popLayout'>
                                {orders.filter(o => o.status === status).map(order => (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        key={order.id}
                                        className="bg-white p-5 rounded-2xl border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer group shadow-sm relative overflow-hidden"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="font-bold text-lg text-yoko-dark">#{order.id}</span>
                                            <span className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded-lg">
                                                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 mb-3">
                                            <div className={`p-1.5 rounded-full ${order.delivery_method === 'pickup' ? 'bg-orange-100 text-orange-600' : 'bg-purple-100 text-purple-600'}`}>
                                                {order.delivery_method === 'pickup' ? <ShoppingBag size={14} /> : <User size={14} />}
                                            </div>
                                            <p className="font-bold text-gray-700 text-sm">{order.customer_name || 'Sin Nombre'}</p>
                                        </div>

                                        <div className="text-xs text-gray-500 mb-4 line-clamp-3 leading-relaxed">
                                            {/* Parse items if string, otherwise map */}
                                            {/* Simplified display for scaffold */}
                                            {Array.isArray(order.items) ? (
                                                <ul className="list-disc pl-4 space-y-1">
                                                    {order.items.map((item: any, idx: number) => (
                                                        <li key={idx}>
                                                            <span className="text-yoko-dark font-medium">1x</span> {item.name || 'Bowl Personalizado'}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : 'Detalles...'}
                                        </div>

                                        <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-2">
                                            <span className="font-bold text-xl text-yoko-primary">${order.total}</span>
                                            {status === 'pending' && (
                                                <button
                                                    onClick={() => updateStatus(order.id, 'preparing')}
                                                    className="bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all transform active:scale-95"
                                                >
                                                    Cocinar
                                                </button>
                                            )}
                                            {status === 'preparing' && (
                                                <button
                                                    onClick={() => updateStatus(order.id, 'completed')}
                                                    className="bg-green-50 text-green-600 border border-green-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-100 transition-all transform active:scale-95"
                                                >
                                                    Completar
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {orders.filter(o => o.status === status).length === 0 && (
                                <div className="text-center py-20 opacity-40">
                                    <div className="text-5xl mb-4 grayscale">🍃</div>
                                    <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Sin pedidos</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
