
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldAlert,
    ShieldCheck,
    Lock,
    Unlock,
    AlertTriangle,
    CheckCircle,
    Loader2,
    Power,
    Settings2,
    MessageSquare,
    ChevronRight,
    Wifi,
    WifiOff
} from 'lucide-react';

export default function DesactivarPage() {
    const [secret, setSecret] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState('Servicio suspendido temporalmente por mantenimiento. Disculpe las molestias.');
    const [loading, setLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (isAuthenticated) {
            checkStatus();
        }
    }, [isAuthenticated]);

    const checkStatus = async () => {
        setStatusLoading(true);
        try {
            const res = await fetch('/api/admin/maintenance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret, action: 'status' }),
            });
            const data = await res.json();
            if (data.success) {
                setMaintenanceMode(data.isActive);
                if (data.message) setMaintenanceMessage(data.message);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setStatusLoading(false);
        }
    };

    const verifySecret = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/admin/maintenance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret, action: 'status' }),
            });

            if (res.ok) {
                setIsAuthenticated(true);
            } else {
                const data = await res.json();
                setError(data.error || 'Acceso denegado.');
            }
        } catch (e) {
            setError('Error de conexión.');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (enable: boolean) => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/admin/maintenance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    secret,
                    action: enable ? 'enable' : 'disable',
                    message: maintenanceMessage
                }),
            });

            const data = await res.json();
            if (data.success) {
                setMaintenanceMode(enable);
                setSuccess(enable ? 'BOT DESACTIVADO' : 'BOT ACTIVADO');
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error || 'Error al actualizar estado');
            }
        } catch (e) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-900/10 blur-[120px] rounded-full" />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md relative z-10"
                >
                    <div className="bg-stone-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
                        {/* Shimmer Effect */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.02] to-white/0 pointer-events-none" />

                        <div className="flex flex-col items-center mb-8">
                            <motion.div
                                className="w-16 h-16 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center mb-4 border border-red-500/30 shadow-lg shadow-red-500/10"
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 4, repeat: Infinity }}
                            >
                                <Lock className="text-red-500" size={32} />
                            </motion.div>
                            <h1 className="text-2xl font-bold tracking-tight">Security Vault</h1>
                            <p className="text-stone-400 text-sm">Panel de Control Critico</p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-stone-500 uppercase tracking-widest ml-1">Access Key</label>
                                <div className="relative group">
                                    <input
                                        type="password"
                                        value={secret}
                                        onChange={(e) => setSecret(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-stone-700"
                                        onKeyDown={(e) => e.key === 'Enter' && verifySecret()}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-red-500/50 transition-colors">
                                        <ShieldAlert size={18} />
                                    </div>
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-xl flex items-center gap-2"
                                    >
                                        <AlertTriangle size={14} />
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <button
                                onClick={verifySecret}
                                disabled={loading}
                                className="w-full group relative bg-white text-black font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 overflow-hidden shadow-xl shadow-white/5"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-10 opacity-transition" />
                                {loading ? <Loader2 className="animate-spin" /> : <Unlock size={18} />}
                                <span>Autenticar Consola</span>
                            </button>
                        </div>
                    </div>

                    <p className="text-center mt-8 text-stone-600 text-[10px] uppercase tracking-[0.3em] font-medium">
                        System Access • YOKO POKE v2.5
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col p-6 relative overflow-hidden font-sans">
            {/* Dynamic Background aura */}
            <motion.div
                className={`absolute top-0 left-0 w-full h-[600px] blur-[100px] opacity-10 rounded-full -translate-y-1/2 transition-colors duration-1000 ${maintenanceMode ? 'bg-red-500' : 'bg-green-500'}`}
                animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.1, 0.15, 0.1]
                }}
                transition={{ duration: 8, repeat: Infinity }}
            />

            <nav className="relative z-10 w-full max-w-5xl mx-auto flex justify-between items-center py-4 mb-12">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${maintenanceMode ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                        <Settings2 size={20} />
                    </div>
                    <div>
                        <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest leading-none mb-1">Admin Console</h2>
                        <p className="text-sm font-semibold">Yoko Poke House</p>
                    </div>
                </div>

                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${maintenanceMode ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-green-500/10 border-green-500/20 text-green-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${maintenanceMode ? 'bg-red-500' : 'bg-green-500'}`} />
                    {maintenanceMode ? 'Maintenance Mode' : 'Live System'}
                </div>
            </nav>

            <main className="flex-1 w-full max-w-5xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Status Card */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-7 space-y-6"
                >
                    <div className={`relative overflow-hidden rounded-[2.5rem] p-10 border transition-all duration-1000 ${maintenanceMode ? 'bg-red-950/20 border-red-500/20' : 'bg-green-950/20 border-green-500/20'}`}>
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            {maintenanceMode ? <ShieldAlert size={200} /> : <ShieldCheck size={200} />}
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-start justify-between mb-8">
                                <div>
                                    <div className={`mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-bold transition-colors ${maintenanceMode ? 'bg-red-500 text-white border-red-400' : 'bg-green-500 text-white border-green-400'}`}>
                                        {maintenanceMode ? <WifiOff size={16} /> : <Wifi size={16} />}
                                        {maintenanceMode ? 'BOT OFFLINE' : 'BOT ONLINE'}
                                    </div>
                                    <h1 className="text-5xl font-black tracking-tight mb-3">
                                        {maintenanceMode ? 'Mantenimiento' : 'Operación Activa'}
                                    </h1>
                                    <p className="text-stone-400 font-medium max-w-md">
                                        {maintenanceMode
                                            ? 'El bot está rechazando pedidos automáticamente. Los usuarios recibirán el mensaje de emergencia.'
                                            : 'El sistema está funcionando correctamente y procesando pedidos en tiempo real.'}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-8 flex gap-4">
                                {!maintenanceMode ? (
                                    <button
                                        onClick={() => handleToggle(true)}
                                        disabled={loading}
                                        className="group flex-1 bg-red-600 hover:bg-red-500 text-white px-8 py-6 rounded-3xl font-bold text-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-2xl shadow-red-600/20"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : <Power size={24} />}
                                        DESACTIVAR SISTEMA
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleToggle(false)}
                                        disabled={loading}
                                        className="group flex-1 bg-green-600 hover:bg-green-500 text-white px-8 py-6 rounded-3xl font-bold text-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-2xl shadow-green-600/20"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : <Power size={24} />}
                                        ACTIVAR SISTEMA
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-stone-900/30 border border-white/5 p-6 rounded-[2rem] backdrop-blur-sm">
                            <p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest mb-1">Base de Datos</p>
                            <p className="text-lg font-bold flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                Conectada
                            </p>
                        </div>
                        <div className="bg-stone-900/30 border border-white/5 p-6 rounded-[2rem] backdrop-blur-sm">
                            <p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest mb-1">WhatsApp Cloud</p>
                            <p className="text-lg font-bold flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                Sincronizado
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Settings Sidebar */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-5"
                >
                    <div className="bg-stone-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 h-full shadow-2xl flex flex-col">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-3 bg-white/5 rounded-2xl">
                                <MessageSquare size={20} className="text-stone-300" />
                            </div>
                            <h3 className="text-xl font-bold">Respuesta Automática</h3>
                        </div>

                        <div className="flex-1 space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest ml-1">Mensaje de Emergencia</label>
                                <div className="relative">
                                    <textarea
                                        value={maintenanceMessage}
                                        onChange={(e) => setMaintenanceMessage(e.target.value)}
                                        rows={6}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-5 text-white/90 text-sm leading-relaxed focus:outline-none focus:border-white/20 transition-all resize-none placeholder:text-stone-800"
                                        placeholder="Escribe el mensaje..."
                                    />
                                    <div className="absolute right-3 bottom-3 opacity-20">
                                        <MessageSquare size={16} />
                                    </div>
                                </div>
                                <p className="text-[10px] text-stone-500 px-1 italic">
                                    Este mensaje se envía de inmediato cuando el bot recibe un mensaje en modo mantenimiento.
                                </p>
                            </div>

                            <AnimatePresence>
                                {(success || error) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className={`p-4 rounded-2xl flex items-center gap-3 border ${success ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}
                                    >
                                        {success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                                        <span className="text-xs font-bold uppercase tracking-wider">{success || error}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/5">
                            <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
                                <span>Ultima Actualización</span>
                                <span>Hoy, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </main>

            <footer className="relative z-10 w-full max-w-5xl mx-auto py-8 text-center border-t border-white/5 mt-12">
                <p className="text-[10px] text-stone-600 font-bold uppercase tracking-[0.4em]">
                    Internal Engine • Secure Access Protocol • 2026
                </p>
            </footer>

            {/* Cinematic Noise Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] contrast-150 grayscale mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        </div>
    );
}

