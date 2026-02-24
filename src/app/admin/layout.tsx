"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Coffee, Settings, LogOut, Menu as MenuIcon, X, Store, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import ToastContainer from '@/components/ui/Toast';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session && pathname !== '/admin/login') {
                router.replace('/admin/login');
            }
            setIsLoading(false);
        };
        checkAuth();
    }, [pathname, router]);

    // Bypass layout for Login page
    if (pathname === '/admin/login') {
        return <>{children}</>;
    }

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-yoko-primary font-bold">Cargando Admin...</div>;
    }

    return (
        <AdminProvider>
            <AdminLayoutContent
                children={children}
                pathname={pathname}
                isMobileNavOpen={isMobileNavOpen}
                setIsMobileNavOpen={setIsMobileNavOpen}
                router={router}
            />
        </AdminProvider>
    );
}

// Inner Component to access Context
import { AdminProvider, useAdmin } from '@/context/AdminContext';
import IncomingOrderModal from '@/components/admin/IncomingOrderModal';
import { Volume2 } from 'lucide-react';

function AdminLayoutContent({ children, pathname, isMobileNavOpen, setIsMobileNavOpen, router }: any) {
    const { testAudio } = useAdmin();

    const navItems = [
        { name: 'Menú & Productos', path: '/admin/menu', icon: <Coffee size={20} /> },
        { name: 'Pedidos', path: '/admin/orders', icon: <LayoutDashboard size={20} /> },
        { name: 'CRM', path: '/admin/crm', icon: <MessageSquare size={20} /> },
        { name: 'Reglas de Armado', path: '/admin/builder', icon: <Settings size={20} /> },
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex font-sans text-slate-900">
            <IncomingOrderModal />
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-100 fixed h-full z-20 shadow-sm">
                <div className="p-6 border-b border-gray-50 flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-yoko-primary via-rose-500 to-orange-500 rounded-2xl flex items-center justify-center text-white font-serif font-black text-2xl shadow-xl shadow-yoko-primary/40">
                        <span className="drop-shadow-md">Y</span>
                    </div>
                    <div>
                        <h1 className="font-black text-slate-900 text-lg tracking-wide">YOKO ADMIN</h1>
                        <p className="text-[10px] text-slate-400 uppercase tracking-[0.15em] font-bold">Panel de Control</p>
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
                                    className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300 relative overflow-hidden group ${isActive ? 'text-white shadow-xl shadow-yoko-primary/40' : 'text-slate-500 hover:text-yoko-primary hover:bg-gradient-to-r hover:from-rose-50 hover:to-orange-50'}`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute inset-0 bg-gradient-to-r from-yoko-primary via-rose-500 to-orange-500 z-0"
                                            initial={false}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-3">
                                        <span className={`transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-md' : 'group-hover:scale-110'}`}>
                                            {item.icon}
                                        </span>
                                        <span className="tracking-wide">{item.name}</span>
                                    </span>
                                </Link>
                            </motion.div>
                        );
                    })}
                </nav>

                <div className="px-4 pb-2">
                    <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-slate-400 hover:text-yoko-primary hover:bg-gradient-to-r hover:from-rose-50 hover:to-orange-50 transition-all duration-300 group">
                        <Store size={20} className="group-hover:scale-110 transition-transform" />
                        <span>Ir a Yoko Publico</span>
                    </Link>
                </div>

                <div className="p-4 border-t border-gray-50">
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut();
                            router.push('/admin/login');
                        }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-red-500 hover:text-red-600 hover:bg-red-50 w-full transition-all duration-300 group"
                    >
                        <LogOut size={20} className="group-hover:scale-110 transition-transform" />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 w-full bg-white z-[60] border-b border-gray-100 px-4 h-16 flex items-center justify-between text-yoko-dark shadow-sm">
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
                        className="fixed inset-0 bg-white z-[50] pt-20 px-6 space-y-4 md:hidden text-yoko-dark"
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
            <main className="flex-1 md:ml-72 p-4 md:p-8 pt-20 md:pt-8 relative overflow-x-hidden">
                {/* Global Audio Test Button (Visible on mobile/desktop for enabling audio context) */}
                <div className="absolute top-4 right-4 z-50 md:hidden">
                    <button onClick={testAudio} className="p-2 bg-white rounded-full shadow-sm text-gray-400 hover:text-yoko-primary"><Volume2 size={20} /></button>
                </div>
                {children}
                <ToastContainer />
            </main>
        </div >
    );
}
