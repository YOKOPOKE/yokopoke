"use client";

import { useState, useEffect } from "react";
import { LoyaltyCard } from "@/components/LoyaltyCard";
import { DynamicQR } from "@/components/DynamicQR";
import { ShoppingBag, Bell, QrCode, X, Search, Smartphone, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [stamps, setStamps] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [viewState, setViewState] = useState<"initial" | "dashboard">("initial");
  const [userName, setUserName] = useState<string>("");
  const [activityLog, setActivityLog] = useState<any[]>([]);

  // Real-time Listener (Supabase)
  useEffect(() => {
    if (!phoneNumber) return;

    const channel = supabase
      .channel('public:tarjeta_lealtad')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tarjeta_lealtad' },
        async () => fetchUserData(phoneNumber)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [phoneNumber]);

  const fetchUserData = async (phone: string) => {
    const { data: client } = await supabase
      .from('clientes')
      .select('id, nombre')
      .eq('telefono', phone)
      .single();

    if (client) {
      if (client.nombre) setUserName(client.nombre);

      const { data: card } = await supabase
        .from('tarjeta_lealtad')
        .select('sellos_aumulados')
        .eq('cliente_id', client.id)
        .single();

      if (card) setStamps(card.sellos_aumulados);

      // 2. Get History
      const { data: moves } = await supabase
        .from('movimientos')
        .select('*')
        .eq('cliente_id', client.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (moves) setActivityLog(moves);
    }
  };

  const handleLogin = async () => {
    if (phoneNumber.length < 10) {
      setError("Ingresa un número válido de 10 dígitos");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data: existingUser } = await supabase
        .from('clientes')
        .select('*')
        .eq('telefono', phoneNumber)
        .single();

      // Try restaurants too if client not found
      if (!existingUser) {
        const { data: restaurant } = await supabase
          .from('restaurantes')
          .select('*')
          .eq('telefono', phoneNumber)
          .single();

        if (!restaurant) {
          setError("Número no registrado. Pide a tu repartidor que te registre. 🔒");
          return;
        }
      }

      await fetchUserData(phoneNumber);
      setViewState("dashboard");
    } catch (e: any) {
      console.error(e);
      setError(`Error de conexión. Intenta de nuevo.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans relative overflow-hidden flex flex-col items-center">

      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[10%] -right-[10%] w-[500px] h-[500px] bg-orange-200/40 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] -left-[10%] w-[400px] h-[400px] bg-blue-100/50 rounded-full blur-[100px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[300px] h-[300px] bg-amber-100/40 rounded-full blur-[80px]" />
      </div>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-4 right-4 z-50 mx-auto max-w-sm glass-card !bg-white/95 !border-red-100 shadow-xl rounded-2xl p-4 flex items-center gap-3"
          >
            <div className="bg-red-50 p-2 rounded-full">
              <X className="w-4 h-4 text-red-500" onClick={() => setError(null)} />
            </div>
            <p className="text-sm font-medium text-slate-700 flex-1">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-md flex flex-col flex-1 relative z-10 px-6 py-6 h-full">

        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
              <span className="text-white font-black text-sm tracking-tighter">PY</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pide Ya</h1>
          </div>
          {viewState === "dashboard" && (
            <button
              onClick={() => setViewState("initial")}
              className="px-3 py-1.5 rounded-full bg-white/50 hover:bg-white text-xs font-semibold text-slate-500 transition-colors"
            >
              Salir
            </button>
          )}
        </header>

        <AnimatePresence mode="wait">
          {viewState === "initial" ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col justify-center space-y-8 pb-20"
            >
              <div className="text-center space-y-3">
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                  Tus recompensas<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500">en un solo lugar</span>
                </h2>
                <p className="text-slate-500 text-lg font-medium max-w-[280px] mx-auto">
                  Ingresa tu número para ver tu progreso y canjear premios.
                </p>
              </div>

              <div className="glass-card p-2 rounded-3xl shadow-2xl shadow-slate-200/50">
                <div className="relative group">
                  <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    type="tel"
                    placeholder="Tu número de celular"
                    className="w-full bg-transparent p-5 pl-14 text-xl font-bold text-slate-900 placeholder:text-slate-300 outline-none text-center tracking-widest"
                    value={phoneNumber}
                    maxLength={10}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setPhoneNumber(val);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold text-xl shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 relative overflow-hidden"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Ver mis Puntos <ChevronRight className="w-5 h-5 opacity-50" /></>
                  )}
                </button>

                <button
                  onClick={() => setShowQr(true)}
                  className="w-full py-4 bg-white/60 backdrop-blur-sm text-slate-700 hover:bg-white rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 border border-white/50"
                >
                  <QrCode className="w-5 h-5 text-orange-600" />
                  Solo mostrar QR
                </button>
              </div>

            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* User Greeting */}
              <div className="glass-card px-5 py-3 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-0.5">Bienvenido</p>
                  <h2 className="text-xl font-bold text-slate-900 truncate">
                    {userName || `Usuario ${phoneNumber.substring(0, 3)}...`}
                  </h2>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20">
                  {userName ? userName[0].toUpperCase() : 'U'}
                </div>
              </div>

              <LoyaltyCard stamps={stamps} loading={loading} />

              {/* History Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 px-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                  Historial Reciente
                </h3>

                <div className="space-y-3">
                  {activityLog.length === 0 ? (
                    <div className="text-center py-10 opacity-50">
                      <p className="text-sm">No hay movimientos recientes</p>
                    </div>
                  ) : (
                    activityLog.map((item: any) => (
                      <div key={item.id} className="glass-card p-4 rounded-2xl flex items-center justify-between group hover:scale-[1.01] transition-transform">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-sm ${item.tipo === 'STAMP'
                            ? 'bg-orange-50 text-orange-600'
                            : 'bg-green-50 text-green-600'
                            }`}>
                            {item.tipo === 'STAMP' ? '🎁' : '🏆'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">
                              {item.tipo === 'STAMP' ? 'Recibiste Puntos' : 'Premio Canjeado'}
                            </p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              {new Date(item.created_at).toLocaleDateString('es-MX', {
                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        {item.tipo === 'STAMP' && (
                          <span className="font-black text-orange-500 text-lg">+1</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-md border border-white/60 rounded-[2.5rem] p-8 text-center space-y-4 shadow-lg shadow-slate-100/50">
                <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2 text-3xl">
                  🚀
                </div>
                <div>
                  <h3 className="text-slate-900 text-xl font-bold mb-1">¿Cómo sumar puntos?</h3>
                  <p className="text-slate-500 text-sm leading-relaxed max-w-[200px] mx-auto">
                    Muestra tu código QR al repartidor cuando recibas tu pedido.
                  </p>
                </div>
                <button
                  onClick={() => setShowQr(true)}
                  className="mt-2 w-full bg-slate-900 text-white px-6 py-4 rounded-xl font-bold shadow-lg shadow-slate-900/10 active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <QrCode className="w-5 h-5" />
                  Mostrar mi QR
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* QR Modal */}
      <AnimatePresence>
        {showQr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-6"
            onClick={() => setShowQr(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowQr(false)}
                className="absolute top-5 right-5 p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center mb-10">
                <h3 className="text-2xl font-black text-slate-900 mb-2">Tu Código QR</h3>
                <p className="text-slate-400 text-sm font-medium">Muestra este código al repartidor</p>
              </div>

              <div className="flex justify-center mb-8">
                <div className="p-4 rounded-3xl bg-white shadow-[0_0_40px_rgba(0,0,0,0.05)] border border-slate-100">
                  <DynamicQR value={phoneNumber} />
                </div>
              </div>

              <div className="text-center">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Tu número registrado</p>
                <p className="text-2xl font-black text-slate-900 tracking-widest font-mono">
                  {phoneNumber || "55 •••• ••••"}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}
