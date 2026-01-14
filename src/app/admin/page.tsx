"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { ChefHat, ShoppingBag, Settings, Coffee, TrendingUp, ArrowRight, Activity, Clock, Sparkles, Calendar } from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export const dynamic = 'force-dynamic';

function TiltCard({ children, className, href }: { children: React.ReactNode, className?: string, href?: string }) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
    const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

    function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
        const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
        const xPct = (event.clientX - left) / width - 0.5;
        const yPct = (event.clientY - top) / height - 0.5;
        x.set(xPct);
        y.set(yPct);
    }

    function handleMouseLeave() {
        x.set(0);
        y.set(0);
    }

    const rotateX = useTransform(mouseY, [-0.5, 0.5], [15, -15]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], [-15, 15]);

    const content = (
        <motion.div
            style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`relative h-full transition-all duration-200 ease-out ${className}`}
        >
            <div style={{ transform: "translateZ(75px)" }} className="absolute inset-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-white/10 blur-2xl rounded-full" />
            {children}
        </motion.div>
    );

    if (href) {
        return (
            <Link href={href} className="group perspective-1000 block h-full">
                {content}
            </Link>
        );
    }
    return <div className="group perspective-1000 h-full">{content}</div>;
}

export default function AdminHub() {
    const supabase = createClient();
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
            // Get current date in local timezone
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');

            // Create start and end timestamps for today in local timezone
            const startOfToday = `${year}-${month}-${day}T00:00:00`;
            const endOfToday = `${year}-${month}-${day}T23:59:59`;

            console.log('🔍 Fetching orders from:', startOfToday, 'to:', endOfToday, '(Local Time)');

            const { data, error } = await supabase
                .from('orders')
                .select('total, status, created_at')
                .gte('created_at', startOfToday)
                .lte('created_at', endOfToday);

            if (error) {
                console.error('❌ Error fetching stats:', error);
            }

            if (data) {
                console.log('✅ Today\'s orders:', data.length, 'orders found');
                console.log('📊 Orders:', data.map(o => ({ created: o.created_at, status: o.status, total: o.total })));
                const revenue = data.reduce((acc: number, order: any) => acc + (order.status !== 'cancelled' && order.status !== 'awaiting_payment' ? order.total : 0), 0);
                const pending = data.filter((o: any) => o.status === 'pending' || o.status === 'preparing').length;
                const completed = data.filter((o: any) => o.status === 'completed').length;
                console.log('💰 Revenue:', revenue, '| ⏳ Pending:', pending, '| ✓ Completed:', completed);
                setStats({ revenue, pending, completed });
            }
            setLoading(false);
        };
        fetchStats();

        // Auto-refresh every minute to update times and check for new day
        const interval = setInterval(() => {
            const now = new Date();
            // If we've crossed into a new day, refresh stats
            if (now.getHours() === 0 && now.getMinutes() === 0) {
                fetchStats();
            }
        }, 60000); // Check every minute

        return () => clearInterval(interval);
    }, []);

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.15, delayChildren: 0.2 }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 40, scale: 0.95 },
        show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", bounce: 0.4 } as const }
    };

    const navCards = [
        {
            title: 'Gestionar Pedidos',
            desc: 'Ver comanda en vivo',
            path: '/admin/orders',
            icon: <ShoppingBag size={28} />,
            gradient: 'from-[#FF416C] to-[#FF4B2B]',
            stat: `${stats.pending} Activos`
        },
        {
            title: 'Menú & Productos',
            desc: 'Editar precios y stock',
            path: '/admin/menu',
            icon: <Coffee size={28} />,
            gradient: 'from-[#8E2DE2] to-[#4A00E0]',
            stat: 'Inventario'
        },
        {
            title: 'Reglas de Armado',
            desc: 'Configura pasos y extras',
            path: '/admin/builder',
            icon: <Settings size={28} />,
            gradient: 'from-[#232526] to-[#414345]',
            stat: 'Configuración'
        },
    ];

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-slate-50 selection:bg-rose-500 selection:text-white">

            {/* --- MESH GRADIENT BACKGROUND --- */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[70vw] h-[70vw] bg-purple-200/40 rounded-full mix-blend-multiply filter blur-[128px] animate-blob" />
                <div className="absolute top-[-10%] right-[-10%] w-[70vw] h-[70vw] bg-rose-200/40 rounded-full mix-blend-multiply filter blur-[128px] animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-20%] left-[20%] w-[70vw] h-[70vw] bg-amber-100/40 rounded-full mix-blend-multiply filter blur-[128px] animate-blob animation-delay-4000" />
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="w-full max-w-6xl space-y-10 relative z-10"
            >
                {/* --- HEADER --- */}
                <motion.div variants={item} className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-900 rounded-lg text-white">
                                <ChefHat size={24} />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Dashboard v3.0</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-sans font-black text-slate-900 tracking-tighter leading-none">
                            {greeting},<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-indigo-600">Chef.</span>
                        </h1>
                    </div>

                    <div className="flex flex-col items-end">
                        <div className="bg-white/50 backdrop-blur-md border border-white/50 px-5 py-2 rounded-full shadow-sm mb-2">
                            <span className="text-sm font-bold text-slate-600 capitalize flex items-center gap-2">
                                <Calendar size={16} className="text-rose-500" />
                                {currentDate}
                            </span>
                        </div>
                        <p className="text-slate-400 text-sm font-medium">Todo listo para el servicio de hoy ✨</p>
                    </div>
                </motion.div>

                {/* --- KPI FLOATERS --- */}
                <motion.div variants={item}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <TiltCard className="bg-white/70 backdrop-blur-2xl px-8 py-10 rounded-[2.5rem] shadow-xl shadow-indigo-100/50 border border-white flex flex-col items-center justify-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-10">
                                <TrendingUp size={120} className="text-slate-900" />
                            </div>
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 z-10">Ingresos Totales</span>
                            <span className="text-6xl font-black text-slate-900 z-10 tracking-tighter">${stats.revenue.toLocaleString()}</span>
                        </TiltCard>

                        <div className="grid grid-cols-2 gap-4 h-full">
                            <TiltCard className="bg-white/70 backdrop-blur-2xl p-6 rounded-[2.5rem] shadow-xl shadow-rose-100/50 border border-white flex flex-col items-center justify-center">
                                <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 mb-3">
                                    <Activity size={24} />
                                </div>
                                <span className="text-4xl font-black text-slate-800">{stats.pending}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Activos</span>
                            </TiltCard>
                            <TiltCard className="bg-white/70 backdrop-blur-2xl p-6 rounded-[2.5rem] shadow-xl shadow-emerald-100/50 border border-white flex flex-col items-center justify-center">
                                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-3">
                                    <Clock size={24} />
                                </div>
                                <span className="text-4xl font-black text-slate-800">{stats.completed}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Completados</span>
                            </TiltCard>
                        </div>

                        <div className="hidden md:flex items-center justify-center">
                            <p className="text-center text-slate-400 text-sm max-w-[200px] leading-relaxed">
                                "La excelencia no es un acto, sino un hábito." <br />
                                <span className="text-rose-500 font-bold">— Aristóteles</span>
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* --- 3D SHORTCUTS --- */}
                <motion.div variants={item} className="grid md:grid-cols-3 gap-6 h-64">
                    {navCards.map((card, i) => (
                        <TiltCard key={i} href={card.path} className="relative w-full h-full rounded-[2.5rem] shadow-2xl overflow-hidden text-white group">
                            {/* Animated Background */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`} />
                            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay" />

                            <div style={{ transform: "translateZ(50px)" }} className="relative z-10 p-8 flex flex-col justify-between h-full">
                                <div className="flex justify-between items-start">
                                    <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                                        {card.icon}
                                    </div>
                                    <span style={{ transform: "translateZ(30px)" }} className="bg-black/30 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold border border-white/10 flex items-center gap-2 shadow-lg">
                                        {stats.pending > 0 && card.path.includes('orders') && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_#4ade80]" />}
                                        {card.stat}
                                    </span>
                                </div>

                                <div>
                                    <h3 style={{ transform: "translateZ(20px)" }} className="text-3xl font-bold mb-2 tracking-tight group-hover:translate-x-2 transition-transform">{card.title}</h3>
                                    <div className="flex items-center gap-2 opacity-80 text-sm font-medium">
                                        {card.desc} <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                                    </div>
                                </div>
                            </div>
                        </TiltCard>
                    ))}
                </motion.div>

            </motion.div>
        </div>
    );
}
