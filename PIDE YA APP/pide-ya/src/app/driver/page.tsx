"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Truck, CheckCircle, Smartphone, Zap, Search, X, Settings, ChevronRight, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Log {
    id: string;
    tipo: string;
    descripcion: string;
    fecha: string;
}

export default function DriverPage() {
    const [phone, setPhone] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [lastAction, setLastAction] = useState<string>("");
    const [history, setHistory] = useState<Log[]>([]);
    const [stats, setStats] = useState({ today: 0 });
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchHistory();
        inputRef.current?.focus();
    }, []);

    const fetchHistory = async () => {
        const { data } = await supabase
            .from('movimientos')
            .select('*')
            .order('fecha', { ascending: false })
            .limit(20);

        if (data) {
            setHistory(data);
            const todayCount = data.filter(d => new Date(d.fecha).getDate() === new Date().getDate()).length;
            setStats({ today: todayCount });
        }
    };

    const handleAddStamp = async (count: number) => {
        if (phone.length < 10) {
            alert("Ingresa un número de 10 dígitos");
            return;
        }

        setStatus("loading");

        try {
            let clientId;

            const { data: client } = await supabase
                .from('clientes')
                .select('id')
                .eq('telefono', phone)
                .single();

            if (client) {
                clientId = client.id;
            } else {
                const { data: newClient, error: createError } = await supabase
                    .from('clientes')
                    .insert([{ telefono: phone, nombre: 'Cliente Nuevo' }])
                    .select('id')
                    .single();

                if (createError) throw createError;
                clientId = newClient?.id;
            }

            const isReward = count >= 6;
            const { error: updateError } = await supabase
                .from('tarjeta_lealtad')
                .update({
                    sellos_aumulados: count,
                    recompensa_disponible: isReward
                })
                .eq('cliente_id', clientId);

            if (updateError) throw updateError;

            const description = isReward ? `Canjeó Recompensa` : `Asignó ${count} Sellos`;
            await supabase.from('movimientos').insert([{
                cliente_id: clientId,
                tipo: isReward ? 'REWARD' : 'STAMP',
                descripcion: description
            }]);

            setLastAction(`${phone} • ${description}`);
            setStatus("success");
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 30, 50]);
            fetchHistory();

            setTimeout(() => {
                setStatus("idle");
                setPhone("");
                inputRef.current?.focus();
            }, 2000);

        } catch (err) {
            console.error(err);
            setStatus("error");
            alert("Error en la operación.");
        }
    };

    return (
        <main className="min-h-screen bg-white text-slate-900 font-sans pb-20">

            {/* Header - Degradado Morado a Azul */}
            <nav className="px-6 py-5 bg-gradient-to-r from-purple-600 to-blue-600 text-white sticky top-0 z-50 shadow-lg">
                <div className="flex items-center justify-between max-w-2xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                            <Truck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="font-black text-xl leading-tight">Driver Panel</h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                <span className="text-xs font-bold text-purple-100">EN LÍNEA</span>
                            </div>
                        </div>
                    </div>
                    <button className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors">
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </nav>

            <div className="px-6 py-6 max-w-2xl mx-auto space-y-6">

                {/* Stats - Tarjetas con Gradientes */}
                <div className="grid grid-cols-2 gap-4">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden"
                    >
                        <div className="absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8" />
                        <Zap className="w-6 h-6 mb-3 opacity-80" />
                        <div className="text-5xl font-black mb-1">{stats.today}</div>
                        <div className="text-sm font-bold text-purple-100">Hoy</div>
                    </motion.div>

                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden"
                    >
                        <div className="absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8" />
                        <Smartphone className="w-6 h-6 mb-3 opacity-80" />
                        <div className="text-lg font-black mb-1">Activo</div>
                        <div className="text-sm font-bold text-blue-100">Escáner listo</div>
                    </motion.div>
                </div>

                {/* Input Card - Blanco con borde morado */}
                <section className="bg-white rounded-3xl p-6 shadow-xl border-2 border-purple-100">
                    <label className="text-xs font-black text-purple-600 uppercase tracking-widest mb-3 block">
                        Identificar Cliente
                    </label>

                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="w-5 h-5 text-purple-400" />
                        </div>
                        <input
                            ref={inputRef}
                            type="tel"
                            placeholder="Número..."
                            value={phone}
                            maxLength={10}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="w-full bg-purple-50 border-2 border-purple-200 rounded-2xl py-4 pl-12 pr-12 text-2xl font-bold text-slate-900 placeholder:text-purple-300 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all"
                        />
                        {phone && (
                            <button
                                onClick={() => setPhone("")}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-purple-400 hover:text-purple-600 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                </section>

                {/* Botones de Sellos - Morados y Azules */}
                <section>
                    <h3 className="text-xs font-black text-purple-600 uppercase tracking-widest mb-4 px-1">
                        Asignar Sellos
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5].map((num) => (
                            <motion.button
                                key={num}
                                disabled={status === 'loading'}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
                                    handleAddStamp(num);
                                }}
                                className="h-20 rounded-2xl font-black text-3xl bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                            >
                                {num}
                            </motion.button>
                        ))}
                        <motion.button
                            disabled={status === 'loading'}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleAddStamp(6)}
                            className="h-20 rounded-2xl font-black bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center"
                        >
                            <Star className="w-6 h-6 mb-1 fill-current" />
                            <span className="text-xs tracking-wide">CANJE</span>
                        </motion.button>
                    </div>
                </section>

                {/* Historial */}
                <section>
                    <h3 className="text-xs font-black text-purple-600 uppercase tracking-widest mb-4 px-1">
                        Actividad Reciente
                    </h3>
                    <div className="space-y-3">
                        {history.slice(0, 5).map((log) => (
                            <div key={log.id} className="bg-white p-4 rounded-2xl flex items-center justify-between border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${log.tipo === 'REWARD' ? 'bg-gradient-to-br from-blue-400 to-blue-500 text-white' : 'bg-gradient-to-br from-purple-400 to-purple-500 text-white'
                                        }`}>
                                        {log.tipo === 'REWARD' ? '🎁' : '⚡'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">
                                            {log.descripcion}
                                        </p>
                                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                                            {new Date(log.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300" />
                            </div>
                        ))}
                    </div>
                </section>

            </div>

            {/* Toast de Éxito - Azul Animado */}
            <AnimatePresence>
                {status === "success" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.8, y: 30 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.8, y: 30 }}
                            transition={{ type: "spring", damping: 20 }}
                            className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl text-center relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />

                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", delay: 0.1, damping: 15 }}
                                className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mx-auto mb-6 relative z-10"
                            >
                                <CheckCircle className="w-14 h-14 text-blue-600" />
                            </motion.div>

                            <h2 className="text-4xl font-black text-white mb-3 tracking-tight relative z-10">¡Excelente!</h2>
                            <p className="text-blue-50 font-bold text-lg mb-6 relative z-10">{lastAction}</p>

                            <motion.div
                                className="h-2 bg-white/20 rounded-full overflow-hidden relative z-10"
                                initial={{ width: 0 }}
                            >
                                <motion.div
                                    className="h-full bg-white rounded-full"
                                    initial={{ width: "0%" }}
                                    animate={{ width: "100%" }}
                                    transition={{ duration: 2, ease: "linear" }}
                                />
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </main>
    );
}
