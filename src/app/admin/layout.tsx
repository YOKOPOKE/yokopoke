"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Coffee, Settings, LogOut, Menu as MenuIcon, X, Store } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase';
import ToastContainer from '@/components/ui/Toast';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const supabase = createClient();

    // Bypass layout for Login page
    if (pathname === '/admin/login') {
        return <>{children}</>;
    }

    const navItems = [
        { name: 'Menú & Productos', path: '/admin/menu', icon: <Coffee size={20} /> },
        { name: 'Pedidos', path: '/admin/orders', icon: <LayoutDashboard size={20} /> },
        { name: 'Configuración', path: '/admin/settings', icon: <Settings size={20} /> },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex font-sans text-yoko-dark">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 fixed h-full z-20 shadow-sm">
                <div className="p-6 border-b border-gray-50 flex items-center gap-3">
                    <div className="w-10 h-10 bg-yoko-primary rounded-xl flex items-center justify-center text-white font-serif font-bold text-xl shadow-lg shadow-yoko-primary/30">Y</div>
                    <div>
                        <h1 className="font-bold text-yoko-dark text-lg tracking-wide">YOKO ADMIN</h1>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Panel de Control</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2 mt-4">
                    {navItems.map((item, index) => {
                        const isActive = pathname === item.path;
                        return (
                            <motion.div
                                key={item.path}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Link
                                    href={item.path}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all relative overflow-hidden group ${isActive ? 'text-white shadow-lg shadow-yoko-primary/30' : 'text-gray-500 hover:text-yoko-primary hover:bg-gray-50'}`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute inset-0 bg-yoko-primary z-0"
                                            initial={false}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-3">
                                        {item.icon}
                                        {item.name}
                                    </span>
                                </Link>
                            </motion.div>
                        );
                    })}
                </nav>

                <div className="px-4 pb-2">
                    <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-gray-400 hover:text-yoko-primary hover:bg-gray-50 transition-colors group">
                        <Store size={20} />
                        Ir a Yoko Publico
                    </Link>
                </div>

                <div className="p-4 border-t border-gray-50">
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut();
                            router.push('/admin/login');
                        }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-400 hover:text-red-500 hover:bg-red-50 w-full transition-colors"
                    >
                        <LogOut size={20} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 w-full bg-white z-20 border-b border-gray-100 px-4 h-16 flex items-center justify-between text-yoko-dark shadow-sm">
                <span className="font-bold text-lg tracking-wide">YOKO ADMIN</span>
                <button onClick={() => setIsMobileNavOpen(!isMobileNavOpen)} className="p-2 active:scale-95 transition text-yoko-primary">
                    {isMobileNavOpen ? <X /> : <MenuIcon />}
                </button>
            </div>

            {/* Mobile Nav Overlay */}
            <AnimatePresence>
                {isMobileNavOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-white z-10 pt-20 px-6 space-y-4 md:hidden text-yoko-dark"
                    >
                        {navItems.map(item => (
                            <Link
                                key={item.path}
                                href={item.path}
                                onClick={() => setIsMobileNavOpen(false)}
                                className={`flex items-center gap-3 px-4 py-4 rounded-xl font-bold text-lg transition-all border border-transparent ${pathname === item.path ? 'bg-yoko-primary text-white shadow-lg' : 'bg-gray-50 text-gray-600'}`}
                            >
                                {item.icon}
                                {item.name}
                            </Link>

                        ))}

                        <div className="pt-8 space-y-4 border-t border-gray-100 mt-4">
                            <Link href="/" onClick={() => setIsMobileNavOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-gray-500 bg-gray-50 w-full">
                                <Store size={20} />
                                Ir a Yoko
                            </Link>
                            <button
                                onClick={async () => {
                                    await supabase.auth.signOut();
                                    router.push('/admin/login');
                                }}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-400 bg-red-50 w-full transition-colors"
                            >
                                <LogOut size={20} />
                                Cerrar Sesión
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-6 pt-24 md:pt-6 relative">
                {children}
                <ToastContainer />
            </main>
        </div >
    );
}
