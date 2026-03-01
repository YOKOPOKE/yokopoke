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
    Wifi,
    WifiOff,
    LayoutDashboard,
    Globe
} from 'lucide-react';

export default function DesactivarPage() {
    const [secret, setSecret] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [botMode, setBotMode] = useState(false);
    const [webEnabled, setWebEnabled] = useState(true);
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
                setBotMode(data.isActive);
                setWebEnabled(data.webProductsEnabled !== false);
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

    const handleToggle = async (target: 'bot' | 'web', enable: boolean) => {
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
                    target,
                    message: maintenanceMessage
                }),
            });

            const data = await res.json();
            if (data.success) {
                if (target === 'bot') setBotMode(enable);
                else setWebEnabled(!enable); // If maintenance enabled, webEnabled is false

                setSuccess(enable ? 'MANTENIMIENTO ACTIVADO' : 'SISTEMA REACTIVADO');
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
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-900/10 blur-[120px] rounded-full" />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md relative z-10"
                >
                    <div className="bg-stone-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.02] to-white/0 pointer-events-none" />

                        <div className="flex flex-col items-center mb-8">
                            <motion.div
                                className="w-16 h-16 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center mb-4 border border-red-500/30"
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 4, repeat: Infinity }}
                            >
                                <Lock className="text-red-500" size={32} />
                            </motion.div>
                            <h1 className="text-2xl font-bold tracking-tight">Security Vault</h1>
                            <p className="text-stone-400 text-sm">Panel de Control Crítico</p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-stone-500 uppercase tracking-widest ml-1">Access Key</label>
                                <input
                                    type="password"
                                    value={secret}
                                    onChange={(e) => setSecret(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-red-500/50 transition-all"
                                    onKeyDown={(e) => e.key === 'Enter' && verifySecret()}
                                />
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
                                className="w-full relative bg-white text-black font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <Unlock size={18} />}
                                <span>Entrar a la Consola</span>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col p-6 relative overflow-hidden font-sans">
            {/* Dynamic Background aura */}
            <motion.div
                className={`absolute top-0 left-0 w-full h-[600px] blur-[100px] opacity-10 rounded-full -translate-y-1/2 transition-colors duration-1000 ${botMode || !webEnabled ? 'bg-red-500' : 'bg-green-500'}`}
                animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.15, 0.1] }}
                transition={{ duration: 8, repeat: Infinity }}
            />

            <nav className="relative z-10 w-full max-w-5xl mx-auto flex justify-between items-center py-4 mb-12">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${botMode || !webEnabled ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                        <Settings2 size={20} />
                    </div>
                    <div>
                        <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest leading-none mb-1">Admin Console</h2>
                        <p className="text-sm font-semibold">Yoko Poke House</p>
                    </div>
                </div>

                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${botMode || !webEnabled ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-green-500/10 border-green-500/20 text-green-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${botMode || !webEnabled ? 'bg-red-500' : 'bg-green-500'}`} />
                    {botMode || !webEnabled ? 'In Maintenance' : 'All Systems Live'}
                </div>
            </nav>

            <main className="flex-1 w-full max-w-5xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">

                <div className="lg:col-span-7 space-y-6">
                    {/* Bot Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`relative overflow-hidden rounded-[2.5rem] p-8 border transition-all duration-700 ${botMode ? 'bg-red-950/20 border-red-500/20 shadow-lg shadow-red-500/5' : 'bg-green-950/20 border-green-500/20 shadow-lg shadow-green-500/5'}`}
                    >
                        <div className="flex items-start justify-between mb-8">
                            <div>
                                <div className={`mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-xl border text-[10px] font-bold transition-colors ${botMode ? 'bg-red-500 text-white border-red-400' : 'bg-green-500 text-white border-green-400'}`}>
                                    {botMode ? <WifiOff size={14} /> : <Wifi size={14} />}
                                    WHATSAPP BOT: {botMode ? 'OFFLINE' : 'ONLINE'}
                                </div>
                                <h3 className="text-3xl font-black tracking-tight mb-2">Bot de Pedidos</h3>
                                <p className="text-stone-400 text-xs font-medium max-w-sm leading-relaxed">
                                    {botMode
                                        ? 'El bot responde con el mensaje automático en WhatsApp.'
                                        : 'El bot está procesando pedidos normalmente en tiempo real.'}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => handleToggle('bot', !botMode)}
                            disabled={loading}
                            className={`group w-full px-8 py-5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${botMode ? 'bg-green-600 hover:bg-green-500 text-white shadow-xl shadow-green-600/20' : 'bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/20'}`}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Power size={20} />}
                            {botMode ? 'REANUDAR WHATSAPP' : 'DETENER WHATSAPP'}
                        </button>
                    </motion.div>

                    {/* Web Catalog Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className={`relative overflow-hidden rounded-[2.5rem] p-8 border transition-all duration-700 ${!webEnabled ? 'bg-red-950/20 border-red-500/20 shadow-lg shadow-red-500/5' : 'bg-green-950/20 border-green-500/20 shadow-lg shadow-green-500/5'}`}
                    >
                        <div className="flex items-start justify-between mb-8">
                            <div>
                                <div className={`mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-xl border text-[10px] font-bold transition-colors ${!webEnabled ? 'bg-red-500 text-white border-red-400' : 'bg-green-500 text-white border-green-400'}`}>
                                    {!webEnabled ? <ShieldAlert size={14} /> : <Globe size={14} />}
                                    WEB CATALOG: {!webEnabled ? 'HIDDEN' : 'VISIBLE'}
                                </div>
                                <h3 className="text-3xl font-black tracking-tight mb-2">Catálogo Web App</h3>
                                <p className="text-stone-400 text-xs font-medium max-w-sm leading-relaxed">
                                    {!webEnabled
                                        ? 'Los productos están ocultos en la web app con mensaje de pausa.'
                                        : 'Los productos y armadores están disponibles para los clientes.'}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => handleToggle('web', webEnabled)}
                            disabled={loading}
                            className={`group w-full px-8 py-5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${!webEnabled ? 'bg-green-600 hover:bg-green-500 text-white shadow-xl shadow-green-600/20' : 'bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/20'}`}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <LayoutDashboard size={20} />}
                            {!webEnabled ? 'MOSTRAR PRODUCTOS WEB' : 'OCULTAR PRODUCTOS WEB'}
                        </button>
                    </motion.div>
                </div>

                {/* Settings Sidebar */}
                <div className="lg:col-span-5 space-y-6">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-stone-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl"
                    >
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-3 bg-white/5 rounded-2xl text-stone-300">
                                <MessageSquare size={20} />
                            </div>
                            <h3 className="text-xl font-bold">Mensajes Masivos</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest ml-1">Respuesta Automática (WHATSAPP)</label>
                                <textarea
                                    value={maintenanceMessage}
                                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                                    rows={5}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-5 text-white/90 text-[13px] leading-relaxed focus:outline-none focus:border-white/20 transition-all resize-none"
                                    placeholder="Mensaje que verán los clientes..."
                                />
                                <p className="text-[10px] text-stone-500 px-1 italic">Este mensaje solo afecta a WhatsApp.</p>
                            </div>

                            <AnimatePresence>
                                {(success || error) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className={`p-4 rounded-2xl flex items-center gap-3 border ${success ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}
                                    >
                                        {success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                                        <span className="text-[10px] font-bold uppercase tracking-wider">{success || error}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>

                    <div className="bg-stone-900/10 border border-white/5 p-4 rounded-2xl text-[9px] text-stone-600 font-bold uppercase tracking-[0.3em] flex justify-between items-center">
                        <span>Terminal v2.7.1</span>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Secure Connection
                        </div>
                    </div>
                </div>
            </main>

            <footer className="relative z-10 w-full max-w-5xl mx-auto py-8 text-center mt-12 opacity-30">
                <p className="text-[9px] text-white font-bold uppercase tracking-[0.5em]">Secret Admin Console • Yoko Poke House</p>
            </footer>

            <div className="absolute inset-0 pointer-events-none opacity-[0.03] contrast-150 grayscale mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        </div>
    );
}
