"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChefHat, ShoppingBag, Settings, Coffee, TrendingUp, Activity, Clock, Calendar, ArrowRight, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import BotSwitch from './components/BotSwitch';
import BusinessHoursEditor from './components/BusinessHoursEditor';

export const dynamic = 'force-dynamic';

export default function AdminDashboard() {
    const router = useRouter();

    const [stats, setStats] = useState({ revenue: 0, pending: 0, completed: 0 });
    const [loading, setLoading] = useState(true);
    const [greeting, setGreeting] = useState('Hola');
    const [currentDate, setCurrentDate] = useState('');

    useEffect(() => {
        const date = new Date();
        const hour = date.getHours();

        // Greeting Logic
        if (hour < 12) setGreeting('Buenos días');
        else if (hour < 19) setGreeting('Buenas tardes');
        else setGreeting('Buenas noches');

        // Date Logic
        const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        setCurrentDate(date.toLocaleDateString('es-ES', options));

        const fetchStats = async () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');

            const startOfToday = `${year}-${month}-${day}T00:00:00`;
            const endOfToday = `${year}-${month}-${day}T23:59:59`;

            const { data, error } = await supabase
                .from('orders')
                .select('total, status, created_at')
                .gte('created_at', startOfToday)
                .lte('created_at', endOfToday);

            if (data) {
                const revenue = data.reduce((acc: number, order: any) => acc + (order.status !== 'cancelled' && order.status !== 'awaiting_payment' ? order.total : 0), 0);
                const pending = data.filter((o: any) => o.status === 'pending' || o.status === 'preparing').length;
                const completed = data.filter((o: any) => o.status === 'completed').length;
                setStats({ revenue, pending, completed });
            }
            setLoading(false);
        };
        fetchStats();

        const interval = setInterval(() => {
            const now = new Date();
            if (now.getHours() === 0 && now.getMinutes() === 0) fetchStats();
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    const navCards = [
        {
            title: 'Gestionar Pedidos',
            desc: 'Ver comanda en vivo',
            path: '/admin/orders',
            icon: <ShoppingBag size={24} />,
            color: 'bg-rose-500',
            textColor: 'text-rose-500',
            bgColor: 'bg-rose-50',
            stat: `${stats.pending} Activos`
        },
        {
            title: 'Menú & Productos',
            desc: 'Editar precios y stock',
            path: '/admin/menu',
            icon: <Coffee size={24} />,
            color: 'bg-violet-500',
            textColor: 'text-violet-500',
            bgColor: 'bg-violet-50',
            stat: 'Inventario'
        },
        {
            title: 'Reglas de Armado',
            desc: 'Configura pasos y extras',
            path: '/admin/builder',
            icon: <Settings size={24} />,
            color: 'bg-slate-800',
            textColor: 'text-slate-800',
            bgColor: 'bg-slate-100',
            stat: 'Configuración'
        },
    ];

    return (
        <div className="min-h-screen p-4 md:p-8 font-sans text-slate-800">
            <div className="max-w-[1600px] mx-auto space-y-8">

                {/* --- HEADER --- */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-slate-900 rounded-lg text-white">
                                <ChefHat size={16} />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Panel de Control</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
                            {greeting}, <span className="text-rose-500">Chef.</span>
                        </h1>
                    </div>

                    <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 text-sm font-bold text-slate-600">
                        <Calendar size={16} className="text-rose-500" />
                        {currentDate}
                    </div>
                </div>

                {/* --- STATS ROW (Matching Orders Page Style) --- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                    {/* Bot Switch (Control) */}
                    <BotSwitch />

                    {/* Business Hours Editor */}
                    <BusinessHoursEditor />

                    {/* Revenue */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-40 hover:shadow-md transition-shadow group relative overflow-hidden"
                    >
                        <div className="flex justify-between items-start z-10">
                            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
                                <BarChart3 size={24} />
                            </div>
                            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Hoy</span>
                        </div>
                        <div className="z-10">
                            <ul className="mt-2 space-y-1">
                                <li><span className="text-3xl font-black text-slate-900 tracking-tight">${stats.revenue.toLocaleString()}</span></li>
                                <li><p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ingresos</p></li>
                            </ul>
                        </div>
                        <div className="absolute right-[-20px] bottom-[-20px] opacity-5 group-hover:scale-110 transition-transform duration-500">
                            <BarChart3 size={140} />
                        </div>
                    </motion.div>

                    {/* Pending */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-40 hover:shadow-md transition-shadow group relative overflow-hidden"
                    >
                        <div className="flex justify-between items-start z-10">
                            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
                                <Activity size={24} />
                            </div>
                            {stats.pending > 0 && <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase animate-pulse">Atención</span>}
                        </div>
                        <div className="z-10">
                            <span className="text-4xl font-black text-slate-900 tracking-tight">{stats.pending}</span>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">Pedidos Activos</p>
                        </div>
                    </motion.div>

                    {/* Completed */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-40 hover:shadow-md transition-shadow group relative overflow-hidden"
                    >
                        <div className="flex justify-between items-start z-10">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
                                <Clock size={24} />
                            </div>
                        </div>
                        <div className="z-10">
                            <span className="text-4xl font-black text-slate-900 tracking-tight">{stats.completed}</span>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">Completados Hoy</p>
                        </div>
                    </motion.div>
                </div>

                {/* --- NAVIGATION CARDS --- */}
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    Accesos Directos
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {navCards.map((card, i) => (
                        <Link key={i} href={card.path}>
                            <motion.div
                                whileHover={{ y: -4 }}
                                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-full flex flex-col justify-between hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`w-14 h-14 rounded-2xl ${card.bgColor} ${card.textColor} flex items-center justify-center shadow-inner`}>
                                        {card.icon}
                                    </div>
                                    <div className={`w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-slate-900 group-hover:bg-slate-100 transition-colors`}>
                                        <ArrowRight size={16} />
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-black text-slate-900 mb-1 group-hover:text-rose-500 transition-colors">{card.title}</h3>
                                    <p className="text-sm text-slate-400 font-medium mb-4">{card.desc}</p>

                                    <div className="inline-block px-3 py-1 bg-slate-50 rounded-lg text-xs font-bold text-slate-500 border border-slate-100">
                                        {card.stat}
                                    </div>
                                </div>
                            </motion.div>
                        </Link>
                    ))}
                </div>

            </div>
        </div>
    );
}
