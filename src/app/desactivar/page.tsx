
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Lock, Unlock, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

export default function DesactivarPage() {
    const [secret, setSecret] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState('Servicio suspendido temporalmente por mantenimiento. Disculpe las molestias.');
    const [loading, setLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Check current status on load (once authenticated)
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
        // Simple verification by trying to fetch status
        try {
            const res = await fetch('/api/admin/maintenance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret, action: 'status' }),
            });

            if (res.ok) {
                setIsAuthenticated(true);
            } else {
                setError('Acceso denegado. Contraseña incorrecta.');
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
                setSuccess(enable ? 'Bot DESACTIVADO (Modo Mantenimiento ACTIVADO)' : 'Bot REACTIVADO (Funcionando normalmente)');
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
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-8 shadow-2xl"
                >
                    <div className="flex justify-center mb-6 text-red-500">
                        <Lock size={48} />
                    </div>
                    <h1 className="text-2xl font-bold text-center mb-2">Acceso Restringido</h1>
                    <p className="text-stone-400 text-center mb-6">Panel de Control de Emergencia</p>

                    <div className="space-y-4">
                        <input
                            type="password"
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                            placeholder="Contraseña de Administrador"
                            className="w-full bg-black border border-stone-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                            onKeyDown={(e) => e.key === 'Enter' && verifySecret()}
                        />

                        {error && (
                            <p className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded">{error}</p>
                        )}

                        <button
                            onClick={verifySecret}
                            disabled={loading}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Unlock size={20} />}
                            Acceder al Panel
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl"
            >
                <div className={`
          relative overflow-hidden rounded-3xl border-2 p-8 shadow-2xl transition-colors duration-500
          ${maintenanceMode ? 'bg-red-950/30 border-red-500/50' : 'bg-green-950/30 border-green-500/50'}
        `}>

                    {/* Header Status */}
                    <div className="flex flex-col items-center mb-10">
                        <motion.div
                            animate={{ rotate: maintenanceMode ? [0, -10, 10, 0] : 0 }}
                            transition={{ duration: 0.5 }}
                            className={`p-6 rounded-full mb-4 ${maintenanceMode ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}
                        >
                            {maintenanceMode ? <ShieldAlert size={64} /> : <ShieldCheck size={64} />}
                        </motion.div>

                        <h1 className="text-4xl font-black tracking-tight mb-2 text-center">
                            {maintenanceMode ? 'SISTEMA BLOQUEADO' : 'SISTEMA OPERATIVO'}
                        </h1>
                        <p className={`text-lg font-medium ${maintenanceMode ? 'text-red-400' : 'text-green-400'}`}>
                            {maintenanceMode ? 'El Bot está desactivado (Modo Mantenimiento)' : 'El Bot está respondiendo normalmente'}
                        </p>
                    </div>

                    <div className="space-y-8">
                        {/* Message Config */}
                        <div className="bg-black/40 rounded-xl p-6 border border-stone-800">
                            <label className="block text-stone-400 text-sm font-bold mb-3 uppercase tracking-wide">
                                Mensaje de Respuesta Automática
                            </label>
                            <textarea
                                value={maintenanceMessage}
                                onChange={(e) => setMaintenanceMessage(e.target.value)}
                                disabled={!maintenanceMode && false}
                                rows={3}
                                className="w-full bg-black border border-stone-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors resize-none"
                                placeholder="Escribe el mensaje que enviará el bot..."
                            />
                            <p className="text-xs text-stone-500 mt-2">
                                Este mensaje se enviará a cualquier usuario que escriba al bot mientras esté bloqueado.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4">
                            {!maintenanceMode ? (
                                <button
                                    onClick={() => handleToggle(true)}
                                    disabled={loading}
                                    className="group relative w-full overflow-hidden rounded-xl bg-red-600 px-8 py-6 text-white shadow-xl transition-all hover:bg-red-700 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <div className="relative z-10 flex items-center justify-center gap-3 font-bold text-xl">
                                        <AlertTriangle size={24} />
                                        <span>DESACTIVAR BOT</span>
                                    </div>
                                    <div className="absolute inset-0 z-0 bg-gradient-to-r from-red-600 via-orange-600 to-red-600 opacity-0 transition-opacity group-hover:opacity-100" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleToggle(false)}
                                    disabled={loading}
                                    className="group relative w-full overflow-hidden rounded-xl bg-green-600 px-8 py-6 text-white shadow-xl transition-all hover:bg-green-700 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <div className="relative z-10 flex items-center justify-center gap-3 font-bold text-xl">
                                        <CheckCircle size={24} />
                                        <span>ACTIVAR BOT</span>
                                    </div>
                                </button>
                            )}
                        </div>

                        <AnimatePresence>
                            {success && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="p-4 bg-white/10 rounded-lg text-center font-medium text-white border border-white/20"
                                >
                                    {success}
                                </motion.div>
                            )}
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="p-4 bg-red-500/20 text-red-200 rounded-lg text-center font-medium border border-red-500/30"
                                >
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                    </div>
                </div>

                <div className="text-center mt-8 text-stone-600 text-sm font-mono">
                    ADMIN CONSOLE • YOKO POKE v2.0
                </div>
            </motion.div>
        </div>
    );
}
