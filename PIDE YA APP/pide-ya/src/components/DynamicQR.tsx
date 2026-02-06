"use client";

import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import { motion } from "framer-motion";

interface DynamicQRProps {
    userId?: string;
    size?: number;
    value?: string; // New prop for direct value
}

export function DynamicQR({ userId = "simulated-user-id", size = 200, value }: DynamicQRProps) {
    const [qrValue, setQrValue] = useState<string | null>(null);

    useEffect(() => {
        if (value) {
            setQrValue(value);
        } else {
            // Fallback for simulation
            setQrValue(JSON.stringify({
                u: userId,
                t: Date.now(),
                app: "pide-ya"
            }));
        }
    }, [userId, value]);

    if (!qrValue) {
        return (
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 relative overflow-hidden min-h-[300px]">
                <div className="animate-pulse bg-slate-100 w-48 h-48 rounded-xl" />
                <p className="text-xs text-slate-300 mt-4 font-medium uppercase tracking-widest">Generando Código...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 relative overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-red-500" />

            <div className="relative z-10 bg-white p-2 rounded-xl">
                <QRCode
                    value={qrValue}
                    size={size}
                    level="H"
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    fgColor="#0f172a"
                />
                {/* Animated Overlay Scanner Line to show it's "live" */}
                <motion.div
                    className="absolute top-0 left-0 w-full h-1 bg-primary/30 shadow-[0_0_10px_rgba(234,88,12,0.5)]"
                    animate={{ top: ["0%", "100%", "0%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
            </div>

            <div className="mt-4 text-center">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Tu Código de Cliente</p>
                <p className="text-sm font-bold text-slate-700 mt-1">Escanea para sumar sello</p>
            </div>
        </div>
    );
}
