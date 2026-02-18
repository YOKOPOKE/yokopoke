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
    full_address?: string;
    address_references?: string;
    location?: {
        latitude?: number;
        longitude?: number;
        address?: string;
        name?: string;
        lat?: number;
        lng?: number;
    };
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
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const { showToast } = useToast();

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
            console.log("DEBUG: Orders fetched", data);
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

                    // Update selected order if it's open
                    if (selectedOrder && selectedOrder.id === updated.id) {
                        setSelectedOrder(updated);
                    }
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [selectedOrder]);

    const updateStatus = async (id: number, status: string) => {
        // Optimistic Update
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as any } : o));
        if (selectedOrder && selectedOrder.id === id) {
            setSelectedOrder({ ...selectedOrder, status: status as any });
        }

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
        <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans text-slate-800">
            {/* Modal Overlay */}
            <AnimatePresence>
                {selectedOrder && (
                    <OrderDetailModal
                        order={selectedOrder}
                        onClose={() => setSelectedOrder(null)}
                        updateStatus={updateStatus}
                    />
                )}
            </AnimatePresence>

            {/* --- DASHBOARD HEADER --- */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 md:px-8 py-4 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <ChefHat className="text-rose-500" />
                            Panel de Cocina
                        </h1>
                        <p className="text-xs text-slate-400 font-semibold mt-1">Gestión en tiempo real</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl">
                            <Search size={18} className="text-slate-400" />
                            <input placeholder="Buscar ID, Cliente..." className="bg-transparent outline-none text-sm font-medium w-48" />
                        </div>
                        <button onClick={fetchOrders} className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Tabs Navigation - Enhanced */}
                <div className="max-w-7xl mx-auto mt-6 overflow-x-auto pb-3 scrollbar-hide">
                    <div className="flex gap-3 md:gap-4 min-w-max md:min-w-0 px-1">
                        {tabs.map(tab => {
                            const isActive = activeTab === tab.id;

                            // Status-specific styling
                            const styles = {
                                pending: {
                                    active: 'bg-gradient-to-br from-rose-500 to-orange-500 text-white border-rose-600 shadow-lg shadow-rose-200',
                                    inactive: 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 hover:border-rose-300'
                                },
                                preparing: {
                                    active: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-blue-600 shadow-lg shadow-blue-200',
                                    inactive: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                                },
                                out_for_delivery: {
                                    active: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white border-amber-600 shadow-lg shadow-amber-200',
                                    inactive: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 hover:border-amber-300'
                                },
                                completed: {
                                    active: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-600 shadow-lg shadow-emerald-200',
                                    inactive: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                }
                            };

                            const styleKey = tab.id as keyof typeof styles;
                            const currentStyle = isActive ? styles[styleKey].active : styles[styleKey].inactive;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`
                                        relative px-4 md:px-6 py-3 md:py-3.5 rounded-2xl
                                        text-xs md:text-sm font-bold
                                        transition-all duration-300 ease-out
                                        whitespace-nowrap flex items-center gap-2 md:gap-3
                                        border-2
                                        ${currentStyle}
                                        ${isActive ? 'scale-105 md:scale-110' : 'hover:scale-105'}
                                        active:scale-95
                                    `}
                                >
                                    <span className={`${isActive ? 'scale-110' : ''} transition-transform`}>
                                        {tab.icon}
                                    </span>
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    <span className="sm:hidden font-black">{tab.label.split(' ')[0]}</span>

                                    {tab.count > 0 && (
                                        <span className={`
                                            px-2 md:px-2.5 py-0.5 md:py-1 rounded-full 
                                            text-[10px] md:text-xs font-black
                                            ${isActive
                                                ? 'bg-white/30 text-white backdrop-blur-sm'
                                                : 'bg-white text-current shadow-sm'
                                            }
                                            min-w-[1.5rem] text-center
                                        `}>
                                            {tab.count}
                                        </span>
                                    )}

                                    {/* Active indicator dot */}
                                    {isActive && (
                                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full shadow-md animate-pulse" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* --- ORDERS LIST (TABLE STYLE) --- */}
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
                <motion.div layout className="space-y-4 md:space-y-5">
                    <AnimatePresence mode='popLayout'>
                        {orders.filter(o => o.status === activeTab).map(order => (
                            <OrderListRow
                                key={order.id}
                                order={order}
                                onClick={() => setSelectedOrder(order)}
                            />
                        ))}
                    </AnimatePresence>

                    {orders.filter(o => o.status === activeTab).length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50">
                            <ChefHat size={48} className="text-slate-300 mb-4" />
                            <p className="font-bold text-slate-400">No hay órdenes en esta sección</p>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}

// --- SUBCOMPONENTS ---

const OrderListRow = ({ order, onClick }: { order: Order, onClick: () => void }) => {
    const elapsed = useElapsedMinutes(order.created_at);

    // Status Logic for Border Color
    const isPending = order.status === 'pending';
    const borderColor = isPending ? 'border-l-rose-500' : 'border-l-slate-200';
    const methodColor = order.delivery_method === 'pickup' ? 'text-orange-600 bg-orange-50 border-orange-200' : 'text-indigo-600 bg-indigo-50 border-indigo-200';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={onClick}
            className={`
                bg-white rounded-2xl border border-slate-200 shadow-sm 
                p-4 md:p-5 cursor-pointer 
                hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5
                transition-all duration-200
                border-l-4 ${borderColor} 
                flex flex-col gap-3 md:gap-0 md:flex-row md:items-center md:justify-between
            `}
        >
            {/* Left: Info */}
            <div className="flex items-center gap-3 md:gap-4">
                <div className={`
                    w-11 h-11 md:w-12 md:h-12 rounded-full 
                    flex items-center justify-center 
                    font-black text-base md:text-lg
                    ${isPending ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-500'}
                    shadow-inner
                `}>
                    {order.id}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-base md:text-lg truncate">
                        {order.customer_name}
                    </h3>
                    <div className="flex items-center gap-2 md:gap-3 text-xs font-semibold text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1">
                            <ShoppingBag size={12} />
                            <span className="hidden xs:inline">{Array.isArray(order.items) ? order.items.length : 1} items</span>
                            <span className="xs:hidden">{Array.isArray(order.items) ? order.items.length : 1}</span>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1">
                            <Timer size={12} /> {elapsed}m
                        </span>
                    </div>
                </div>
            </div>

            {/* Right: Meta & Total */}
            <div className="flex items-center justify-between md:justify-end gap-3 md:gap-6">
                <span className={`
                    px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg 
                    text-[10px] md:text-xs font-bold uppercase tracking-wide 
                    flex items-center gap-1.5 
                    border ${methodColor}
                    whitespace-nowrap
                `}>
                    {order.delivery_method === 'pickup' ? <ShoppingBag size={12} className="md:w-3.5 md:h-3.5" /> : <MapPin size={12} className="md:w-3.5 md:h-3.5" />}
                    <span className="hidden sm:inline">{order.delivery_method === 'pickup' ? 'Recoger' : 'Domicilio'}</span>
                    <span className="sm:hidden">{order.delivery_method === 'pickup' ? 'Pick' : 'Deliv'}</span>
                    {order.delivery_method === 'pickup' && order.pickup_time && (
                        <span className="hidden md:inline text-[10px] opacity-75">• {order.pickup_time}</span>
                    )}
                </span>
                <p className="font-black text-lg md:text-xl text-slate-900">${order.total}</p>
            </div>
        </motion.div>
    );
};

// --- MODAL DETALLE ---
const OrderDetailModal = ({ order, onClose, updateStatus }: { order: Order, onClose: () => void, updateStatus: any }) => {
    // Prevent scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    const safeItems = Array.isArray(order.items) ? order.items : (order.items ? [order.items] : []);

    const isPending = order.status === 'pending';
    const isPreparing = order.status === 'preparing';
    const isOutForDelivery = order.status === 'out_for_delivery';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl relative z-10 flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Orden #{order.id}</p>
                        <h2 className="text-2xl font-black text-slate-900">{order.customer_name}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition-colors">
                        <MoreHorizontal size={24} className="text-slate-400" />
                    </button>
                </div>

                {/* Body Scrolling */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* INFO CONTACTO / ENTREGA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <h4 className="flex items-center gap-2 font-bold text-sm text-slate-900 mb-3">
                                <User size={16} className="text-slate-400" /> Cliente
                            </h4>
                            <p className="text-sm font-medium text-slate-600 mb-1">{order.phone || 'Sin télefono'}</p>
                            <p className="text-xs text-rose-500 font-bold bg-rose-50 inline-block px-2 py-1 rounded-md">
                                {order.payment_status === 'paid' ? 'Pagado' : 'Pago Pendiente'}
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                            <h4 className="flex items-center gap-2 font-bold text-sm text-indigo-900 mb-3">
                                {order.delivery_method === 'pickup' ? <ShoppingBag size={16} /> : <MapPin size={16} />}
                                {order.delivery_method === 'pickup' ? 'Recoger en Tienda' : 'Envío a Domicilio'}
                            </h4>

                            {order.delivery_method === 'pickup' ? (
                                <div>
                                    <p className="text-xs font-bold text-indigo-400 uppercase">Hora Estimada</p>
                                    <p className="text-lg font-black text-indigo-900">{order.pickup_time || 'Lo antes posible'}</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-xs font-bold text-indigo-400 uppercase">Dirección de Entrega</p>
                                    <p className="text-sm font-bold text-indigo-900 leading-snug">{order.address || 'Sin dirección registrada'}</p>
                                    {/* Link a Maps podría ir aquí */}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ITEMS LIST */}
                    <div>
                        <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                            <ChefHat size={20} className="text-slate-400" />
                            Detalle del Pedido
                        </h3>
                        <div className="space-y-4">
                            {safeItems.map((item: any, i) => {
                                if (!item) return null;
                                return (
                                    <div key={i} className="flex gap-4 p-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
                                        <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black">1</div>
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-900 text-lg">{item.name || 'Producto'}</p>
                                            <div className="mt-2 space-y-1 text-sm text-slate-600">
                                                {item.base && <p><span className="font-bold text-slate-400 text-xs uppercase w-12 inline-block">Base</span> {item.base.name}</p>}
                                                {item.proteins && item.proteins.map((p: any, j: number) => (
                                                    <p key={j}><span className="font-bold text-rose-400 text-xs uppercase w-12 inline-block">Prot</span> {p.name}</p>
                                                ))}
                                                {item.sauce && <p><span className="font-bold text-amber-400 text-xs uppercase w-12 inline-block">Salsa</span> {item.sauce.name}</p>}
                                                {item.extras && item.extras.length > 0 && (
                                                    <div className="pt-1 mt-1 border-t border-dashed border-slate-200">
                                                        <span className="font-bold text-blue-400 text-xs uppercase block mb-1">Extras</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {item.extras.map((e: any, k: number) => (
                                                                <span key={k} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-bold">+ {e.name}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Fallback for generic JSON items (from our recent fix) if specific fields missing */}
                                                {!item.base && !item.proteins && !item.productType && Object.keys(item).map(key => {
                                                    if (['name', 'productType', 'base_price'].includes(key)) return null;
                                                    const val = item[key];
                                                    return (
                                                        <p key={key} className="text-slate-600">
                                                            <span className="font-bold text-slate-400 text-xs uppercase mr-2">{key}:</span>
                                                            {Array.isArray(val) ? val.join(', ') : val}
                                                        </p>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Total a Cobrar</p>
                        <p className="text-3xl font-black text-slate-900">${order.total}</p>
                    </div>

                    <div className="flex gap-3 w-full sm:w-auto">
                        {isPending && (
                            <button onClick={() => { updateStatus(order.id, 'preparing'); onClose(); }} className="flex-1 sm:flex-none bg-rose-500 hover:bg-rose-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-rose-200 transition-all">
                                🔥 A Cocinar
                            </button>
                        )}
                        {isPreparing && (
                            order.delivery_method === 'delivery' ? (
                                <button onClick={() => { updateStatus(order.id, 'out_for_delivery'); onClose(); }} className="flex-1 sm:flex-none bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all">
                                    🛵 Enviar
                                </button>
                            ) : (
                                <button onClick={() => { updateStatus(order.id, 'completed'); onClose(); }} className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all">
                                    ✅ Listo para Recoger
                                </button>
                            )
                        )}
                        {isOutForDelivery && (
                            <button onClick={() => { updateStatus(order.id, 'completed'); onClose(); }} className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all">
                                ✅ Confirmar Entrega
                            </button>
                        )}
                        <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">
                            Cerrar
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
