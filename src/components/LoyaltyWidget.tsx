"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Star, Phone, X, Award, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Init Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function LoyaltyWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [clientData, setClientData] = useState<any>(null);
    const [error, setError] = useState("");

    // Detect Mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
    }, [isOpen]);

    const vibrate = () => {
        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
            window.navigator.vibrate(10);
        }
    };

    const checkLoyalty = async () => {
        if (phone.length < 10) return;
        vibrate();
        setLoading(true);
        setError("");

        // Min loading time for effect
        const minLoad = new Promise(resolve => setTimeout(resolve, 800));

        try {
            const fetchPromise = (async () => {
                // 1. Find Client
                let { data: client } = await supabase
                    .from('clientes')
                    .select('*, tarjeta_lealtad(*)')
                    .eq('telefono', phone)
                    .maybeSingle();

                if (!client) {
                    // Try Restaurants
                    const { data: rest } = await supabase
                        .from('restaurantes')
                        .select('*')
                        .eq('telefono', phone)
                        .maybeSingle();

                    if (rest) {
                        client = rest;
                        const { data: card } = await supabase
                            .from('tarjeta_lealtad')
                            .select('*')
                            .eq('cliente_id', rest.id)
                            .maybeSingle();
                        client.tarjeta_lealtad = card;
                    }
                }

                if (client) {
                    // 2. Fetch Profile
                    const { data: profile } = await supabase
                        .from('client_profiles')
                        .select('*')
                        .eq('client_id', client.id)
                        .maybeSingle();

                    // 3. Stats
                    const { count: visits } = await supabase
                        .from('movimientos')
                        .select('id', { count: 'exact' })
                        .eq('cliente_id', client.id)
                        .eq('tipo', 'STAMP');

                    let tier = 'BRONZE';
                    if ((visits || 0) > 30) tier = 'GOLD';
                    else if ((visits || 0) > 10) tier = 'SILVER';

                    return {
                        ...client,
                        profile,
                        tier,
                        visits: visits || 0
                    };
                }
                return null;
            })();

            const [client] = await Promise.all([fetchPromise, minLoad]);

            if (client) {
                setClientData(client);
                vibrate(); // Success vibration
            } else {
                setError("No encontramos este número. ¡Pide hoy para obtener tu tarjeta!");
                if (typeof window !== 'undefined' && window.navigator?.vibrate) window.navigator.vibrate([10, 50, 10]); // Error vibe
            }

        } catch (err) {
            console.error(err);
            setError("Error de conexión. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { setIsOpen(true); vibrate(); }}
                className="text-yoko-dark hover:text-yoko-accent transition flex items-center gap-2 font-semibold uppercase text-sm tracking-wide"
            >
                <Star className="w-4 h-4" /> Lealtad
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex justify-center items-end md:items-center">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Card / Sheet */}
                        <motion.div
                            initial={isMobile ? { y: "100%" } : { scale: 0.9, opacity: 0 }}
                            animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1 }}
                            exit={isMobile ? { y: "100%" } : { scale: 0.9, opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className={`
                                bg-[#F7F9F5] w-full max-w-md relative z-10 overflow-hidden shadow-2xl
                                ${isMobile ? 'rounded-t-3xl h-[85vh]' : 'rounded-3xl max-h-[90vh]'}
                            `}
                        >
                            {/* Mobile Drag Handle */}
                            {isMobile && (
                                <div className="w-full h-6 flex justify-center items-center absolute top-0 z-20" onClick={() => setIsOpen(false)}>
                                    <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                                </div>
                            )}

                            {/* Header */}
                            <div className="bg-yoko-dark p-8 md:p-6 text-center relative overflow-hidden shrink-0">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                    className="absolute -top-10 -right-10 opacity-10"
                                >
                                    <Star size={180} color="white" />
                                </motion.div>

                                <h2 className="text-3xl font-serif font-bold text-white mb-2 relative z-10">Club Pide Ya</h2>
                                <p className="text-white/60 text-xs tracking-[0.2em] uppercase relative z-10 font-bold">Tu Nivel y Recompensas</p>

                                {!isMobile && (
                                    <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-white/50 hover:text-white transition">
                                        <X size={24} />
                                    </button>
                                )}
                            </div>

                            <div className="p-8 overflow-y-auto h-full pb-20 scrollbar-hide">
                                <AnimatePresence mode="wait">
                                    {!clientData && !loading ? (
                                        <motion.div
                                            key="login"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="flex flex-col gap-6"
                                        >
                                            <div className="text-center mb-4">
                                                <p className="text-gray-500 text-sm">Ingresa tu número celular vinculado para consultar tus sellos y beneficios.</p>
                                            </div>

                                            <div className="relative group">
                                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-yoko-primary transition" />
                                                <input
                                                    type="tel"
                                                    autoFocus={!isMobile}
                                                    value={phone}
                                                    onChange={(e) => setPhone(e.target.value)}
                                                    placeholder="Tu Celular (10 dígitos)"
                                                    className="w-full pl-12 pr-4 py-5 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-yoko-primary/20 focus:border-yoko-primary outline-none transition font-mono text-xl text-center tracking-widest"
                                                    onKeyDown={(e) => e.key === 'Enter' && checkLoyalty()}
                                                />
                                            </div>

                                            <motion.button
                                                whileTap={{ scale: 0.98 }}
                                                onClick={checkLoyalty}
                                                disabled={phone.length < 10}
                                                className="bg-yoko-primary text-white py-5 rounded-2xl font-bold uppercase tracking-wider hover:bg-yoko-dark transition shadow-lg shadow-yoko-primary/30 disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2 text-lg"
                                            >
                                                Consultar Puntos
                                            </motion.button>

                                            {error && (
                                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex items-center gap-3 justify-center">
                                                    <Award className="w-5 h-5 shrink-0" />
                                                    {error}
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    ) : loading ? (
                                        <motion.div
                                            key="loading"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex flex-col gap-6"
                                        >
                                            {/* Skeleton Card */}
                                            <div className="w-full h-48 rounded-3xl bg-gray-200 relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-12 animate-shimmer" style={{ width: '200%', transform: 'translateX(-100%)' }} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="h-24 rounded-3xl bg-gray-100 animate-pulse" />
                                                <div className="h-24 rounded-3xl bg-gray-100 animate-pulse" />
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="stats"
                                            initial={{ opacity: 0, rotateX: 90 }}
                                            animate={{ opacity: 1, rotateX: 0 }}
                                            transition={{ type: "spring", damping: 20 }}
                                            className="flex flex-col gap-6 perspective-1000"
                                        >
                                            {/* Status Card */}
                                            <div className={`p-1 rounded-3xl bg-gradient-to-br shadow-xl ${clientData.tier === 'GOLD' ? 'from-amber-200 via-yellow-400 to-yellow-700' :
                                                clientData.tier === 'SILVER' ? 'from-gray-100 via-gray-300 to-gray-500' :
                                                    'from-orange-100 via-orange-200 to-orange-400'
                                                }`}>
                                                <div className="bg-white/90 backdrop-blur-sm rounded-[20px] p-6 relative overflow-hidden">
                                                    {/* Shine effect */}
                                                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 opacity-50" />

                                                    <div className="flex justify-between items-start mb-8 relative z-10">
                                                        <div>
                                                            <h3 className="font-bold text-2xl text-gray-900 leading-none">{clientData.nombre}</h3>
                                                            <span className="text-xs font-mono text-gray-400 mt-1 block">{phone}</span>
                                                        </div>
                                                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-inner ${clientData.tier === 'GOLD' ? 'bg-amber-100 text-amber-800' :
                                                            clientData.tier === 'SILVER' ? 'bg-gray-100 text-gray-800' :
                                                                'bg-orange-50 text-orange-800'
                                                            }`}>
                                                            {clientData.tier} MEMBER
                                                        </div>
                                                    </div>

                                                    {/* Stamps Grid */}
                                                    <div className="flex justify-between items-center bg-gray-50 rounded-2xl p-4 mb-4 shadow-inner relative z-10">
                                                        {[...Array(6)].map((_, i) => {
                                                            const userStamps = clientData.tarjeta_lealtad?.sellos_aumulados || 0;
                                                            const filled = i < userStamps;
                                                            return (
                                                                <motion.div
                                                                    key={i}
                                                                    initial={{ scale: 0 }}
                                                                    animate={{ scale: 1 }}
                                                                    transition={{ delay: i * 0.1 }}
                                                                    className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${filled ? 'bg-yoko-primary border-yoko-primary text-white shadow-lg shadow-yoko-primary/30 scale-110' : 'bg-white border-dashed border-gray-300 text-gray-200'
                                                                        }`}>
                                                                    {filled ? <Star size={16} fill="currentColor" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                                                                </motion.div>
                                                            )
                                                        })}
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-xs font-bold text-yoko-accent uppercase tracking-widest">
                                                            {(clientData.tarjeta_lealtad?.sellos_aumulados || 0) >= 6
                                                                ? "¡Tienes un premio disponible!"
                                                                : `Te faltan ${6 - (clientData.tarjeta_lealtad?.sellos_aumulados || 0)} sellos para tu premio`}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Stats Row */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                                                    <span className="text-3xl font-black text-yoko-dark font-serif">{clientData.visits}</span>
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Visitas</span>
                                                </div>
                                                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                                                    <div className="flex -space-x-2 mb-1">
                                                        {(clientData.profile?.tags as string[] || []).slice(0, 3).map((t, i) => (
                                                            <div key={i} className="w-6 h-6 rounded-full bg-yoko-accent/20 border-2 border-white flex items-center justify-center text-[10px]">🏷️</div>
                                                        ))}
                                                        {(clientData.profile?.tags?.length || 0) === 0 && <span className="text-2xl">🥚</span>}
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Insignias</span>
                                                </div>
                                            </div>

                                            <button onClick={() => setClientData(null)} className="py-4 text-center text-sm text-gray-400 hover:text-yoko-dark font-semibold transition uppercase tracking-wide">
                                                Consultar otro número
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
