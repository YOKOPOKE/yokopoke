"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    ChefHat, ShoppingBag, Settings, Coffee, TrendingUp,
    Clock, Calendar, ArrowRight, BarChart3, MapPin, Store,
    Flame, Truck, Package, DollarSign, Users, Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import BotSwitch from './components/BotSwitch';
import BusinessHoursEditor from './components/BusinessHoursEditor';

export const dynamic = 'force-dynamic';

interface RecentOrder {
    id: number;
    customer_name: string;
    total: number;
    status: string;
    delivery_method?: string;
    created_at: string;
    items?: any[];
}

export default function AdminDashboard() {
    const router = useRouter();

    const [stats, setStats] = useState({
        revenue: 0, pending: 0, completed: 0,
        pickupCount: 0, deliveryCount: 0, totalOrders: 0,
        avgTicket: 0
    });
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [greeting, setGreeting] = useState('Hola');
    const [currentDate, setCurrentDate] = useState('');
    const [currentTime, setCurrentTime] = useState('');

    useEffect(() => {
        const date = new Date();
        const hour = date.getHours();

        if (hour < 12) setGreeting('Buenos días');
        else if (hour < 19) setGreeting('Buenas tardes');
        else setGreeting('Buenas noches');

        const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
        setCurrentDate(date.toLocaleDateString('es-MX', options));
        setCurrentTime(date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));

        const fetchStats = async () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');

            const startOfToday = `${year}-${month}-${day}T00:00:00`;
            const endOfToday = `${year}-${month}-${day}T23:59:59`;

            const { data } = await supabase
                .from('orders')
                .select('id, customer_name, total, status, delivery_method, created_at, items')
                .gte('created_at', startOfToday)
                .lte('created_at', endOfToday)
                .order('created_at', { ascending: false });

            if (data) {
                const validOrders = data.filter((o: any) => o.status !== 'cancelled');
                const revenue = validOrders.reduce((acc: number, o: any) => acc + (o.total || 0), 0);
                const pending = data.filter((o: any) => o.status === 'pending' || o.status === 'preparing').length;
                const completed = data.filter((o: any) => o.status === 'completed').length;
                const pickupCount = validOrders.filter((o: any) => o.delivery_method === 'pickup').length;
                const deliveryCount = validOrders.filter((o: any) => o.delivery_method === 'delivery').length;
                const avgTicket = validOrders.length > 0 ? Math.round(revenue / validOrders.length) : 0;

                setStats({
                    revenue, pending, completed,
                    pickupCount, deliveryCount,
                    totalOrders: validOrders.length,
                    avgTicket
                });

                setRecentOrders(data.slice(0, 6) as RecentOrder[]);
            }
            setLoading(false);
        };
        fetchStats();

        // Refresh stats every 30 seconds
        const interval = setInterval(fetchStats, 30000);

        // Update time every minute
        const timeInterval = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
        }, 60000);

        return () => { clearInterval(interval); clearInterval(timeInterval); };
    }, []);

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'pending': return { label: 'Nuevo', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
            case 'preparing': return { label: 'Cocinando', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' };
            case 'out_for_delivery': return { label: 'En Ruta', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' };
            case 'completed': return { label: 'Listo', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
            case 'cancelled': return { label: 'Cancel.', color: 'bg-red-100 text-red-600', dot: 'bg-red-500' };
            default: return { label: status, color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
        }
    };

    const getElapsed = (dateStr: string) => {
        const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
        if (mins < 1) return 'Ahora';
        if (mins < 60) return `${mins}m`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    };

    const navCards = [
        {
            title: 'Comanda en Vivo',
            desc: 'Gestionar pedidos activos',
            path: '/admin/orders',
            icon: <Flame size={24} />,
            gradient: 'from-rose-500 to-orange-500',
            stat: `${stats.pending} activos`,
            urgent: stats.pending > 0
        },
        {
            title: 'Menú & Productos',
            desc: 'Editar precios y stock',
            path: '/admin/menu',
            icon: <Coffee size={24} />,
            gradient: 'from-violet-500 to-indigo-500',
            stat: 'Inventario'
        },
        {
            title: 'Reglas de Armado',
            desc: 'Configura pasos y extras',
            path: '/admin/builder',
            icon: <Settings size={24} />,
            gradient: 'from-slate-700 to-slate-900',
            stat: 'Configuración'
        },
    ];

    return (
        <div className="min-h-screen font-sans text-slate-800">
            <div className="max-w-[1600px] mx-auto space-y-6">

                {/* --- HEADER --- */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">{currentDate}</p>
                        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                            {greeting}, <span className="bg-gradient-to-r from-rose-500 to-orange-500 bg-clip-text text-transparent">Chef.</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 text-sm font-black text-slate-700">
                            <Clock size={16} className="text-rose-500" />
                            {currentTime}
                        </div>
                    </div>
                </div>

                {/* --- KPI STRIP --- */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Revenue */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                                <DollarSign size={20} />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Hoy</span>
                        </div>
                        <p className="text-2xl md:text-3xl font-black text-slate-900">${stats.revenue.toLocaleString()}</p>
                        <p className="text-xs font-bold text-slate-400 mt-1">Ingresos del día</p>
                    </motion.div>

                    {/* Active Orders */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className={`p-5 rounded-2xl shadow-sm border relative overflow-hidden group hover:shadow-md transition-all ${stats.pending > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'}`}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.pending > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                                <Flame size={20} />
                            </div>
                            {stats.pending > 0 && <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full uppercase animate-pulse">Atención</span>}
                        </div>
                        <p className="text-2xl md:text-3xl font-black text-slate-900">{stats.pending}</p>
                        <p className="text-xs font-bold text-slate-400 mt-1">Pedidos activos</p>
                    </motion.div>

                    {/* Avg Ticket */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-500">
                                <TrendingUp size={20} />
                            </div>
                        </div>
                        <p className="text-2xl md:text-3xl font-black text-slate-900">${stats.avgTicket}</p>
                        <p className="text-xs font-bold text-slate-400 mt-1">Ticket promedio</p>
                    </motion.div>

                    {/* Completed */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                                <Users size={20} />
                            </div>
                        </div>
                        <p className="text-2xl md:text-3xl font-black text-slate-900">{stats.totalOrders}</p>
                        <p className="text-xs font-bold text-slate-400 mt-1">{stats.completed} completados</p>
                    </motion.div>
                </div>

                {/* --- CONTROLS + DELIVERY SPLIT --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <BotSwitch />
                    <BusinessHoursEditor />

                    {/* Pickup vs Delivery Split */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-40 flex flex-col justify-between relative overflow-hidden hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                                <Truck size={24} />
                            </div>
                            <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Método</span>
                        </div>
                        <div className="flex items-end gap-6">
                            <div>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <Store size={14} className="text-amber-500" />
                                    <span className="text-2xl font-black text-slate-900">{stats.pickupCount}</span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Recoger</p>
                            </div>
                            <div className="w-px h-8 bg-slate-200" />
                            <div>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <Truck size={14} className="text-indigo-500" />
                                    <span className="text-2xl font-black text-slate-900">{stats.deliveryCount}</span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Domicilio</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Quick Action */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        onClick={() => router.push('/admin/orders')}
                        className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl shadow-sm border border-slate-700 h-40 flex flex-col justify-between cursor-pointer hover:shadow-xl transition-all group relative overflow-hidden"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                            <Zap size={24} />
                        </div>
                        <div>
                            <p className="text-white font-black text-lg group-hover:text-rose-300 transition-colors">Ir a Comanda →</p>
                            <p className="text-slate-400 text-xs font-bold">Gestión en tiempo real</p>
                        </div>
                        <div className="absolute right-[-20px] bottom-[-20px] opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <ChefHat size={120} className="text-white" />
                        </div>
                    </motion.div>
                </div>

                {/* --- LIVE ORDERS FEED + NAV CARDS --- */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* Live Feed */}
                    <div className="xl:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                Últimos Pedidos
                            </h2>
                            <Link href="/admin/orders" className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1">
                                Ver todos <ArrowRight size={14} />
                            </Link>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            {loading ? (
                                <div className="p-12 text-center text-slate-400 font-bold">Cargando pedidos...</div>
                            ) : recentOrders.length === 0 ? (
                                <div className="p-12 text-center">
                                    <ChefHat size={48} className="text-slate-200 mx-auto mb-3" />
                                    <p className="text-slate-400 font-bold">No hay pedidos hoy</p>
                                    <p className="text-xs text-slate-300 mt-1">Los pedidos aparecerán aquí en tiempo real</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {recentOrders.map((order, i) => {
                                        const sc = getStatusConfig(order.status);
                                        const itemCount = Array.isArray(order.items) ? order.items.length : 0;
                                        return (
                                            <motion.div
                                                key={order.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                onClick={() => router.push('/admin/orders')}
                                                className="flex items-center gap-4 p-4 hover:bg-slate-50/50 cursor-pointer transition-colors group"
                                            >
                                                {/* Status Dot */}
                                                <div className={`w-2.5 h-2.5 rounded-full ${sc.dot} ${order.status === 'pending' ? 'animate-pulse' : ''} shrink-0`} />

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-slate-900 text-sm truncate">{order.customer_name || 'Sin nombre'}</p>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${sc.color}`}>{sc.label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-slate-400 font-medium">#{order.id}</span>
                                                        <span className="text-slate-200">·</span>
                                                        {order.delivery_method === 'pickup' ? (
                                                            <span className="text-xs text-amber-600 font-bold flex items-center gap-0.5"><Store size={10} /> Recoger</span>
                                                        ) : (
                                                            <span className="text-xs text-indigo-600 font-bold flex items-center gap-0.5"><Truck size={10} /> Domicilio</span>
                                                        )}
                                                        <span className="text-slate-200">·</span>
                                                        <span className="text-xs text-slate-400">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
                                                    </div>
                                                </div>

                                                {/* Right */}
                                                <div className="text-right shrink-0">
                                                    <p className="font-black text-slate-900 text-sm">${order.total}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">{getElapsed(order.created_at)}</p>
                                                </div>

                                                <ArrowRight size={14} className="text-slate-200 group-hover:text-slate-400 transition-colors shrink-0" />
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Nav Cards Stack */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-black text-slate-900">Accesos Rápidos</h2>
                        {navCards.map((card, i) => (
                            <Link key={i} href={card.path}>
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    whileHover={{ x: 4 }}
                                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all group mb-4"
                                >
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white shadow-lg shrink-0`}>
                                        {card.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-900 text-sm group-hover:text-rose-500 transition-colors">{card.title}</h3>
                                        <p className="text-xs text-slate-400 font-medium">{card.desc}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {card.urgent && <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full animate-pulse">{card.stat}</span>}
                                        <ArrowRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                                    </div>
                                </motion.div>
                            </Link>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
