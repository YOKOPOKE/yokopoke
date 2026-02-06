"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Home, Clock, LifeBuoy, User } from "lucide-react";
import { motion } from "framer-motion";

interface BottomNavProps {
    onUiChange?: (view: string) => void;
}

export function BottomNav({ onUiChange }: BottomNavProps) {
    const [active, setActive] = useState("home");

    const navItems = [
        { id: "home", icon: Home, label: "Inicio" },
        { id: "history", icon: Clock, label: "Historial" },
        { id: "support", icon: LifeBuoy, label: "Ayuda" },
        { id: "profile", icon: User, label: "Perfil" },
    ];

    return (
        <div
            className="fixed z-[99999] flex items-center justify-center w-full pointer-events-none"
            style={{ bottom: '32px', left: 0, right: 0 }}
        >
            <div
                className="pointer-events-auto flex items-center gap-6 px-8 py-4 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-xl"
                style={{
                    backgroundColor: '#0f172a', // Pure Slate 900
                    boxShadow: '0 20px 60px -10px rgba(0,0,0,0.5)',
                }}
            >

                {navItems.map((item) => {
                    const isActive = active === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => {
                                setActive(item.id);
                                if (onUiChange) onUiChange(item.id);
                            }}
                            className="relative w-12 h-12 flex items-center justify-center transition-all group"
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="nav-pill"
                                    className="absolute -top-1 w-1 h-1 bg-orange-500 rounded-full"
                                    initial={false}
                                />
                            )}

                            <div className="relative z-10 flex flex-col items-center gap-1">
                                <item.icon
                                    className={cn(
                                        "w-6 h-6 transition-all duration-300",
                                        isActive ? "text-orange-500" : "text-slate-400 group-hover:text-slate-200"
                                    )}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                            </div>
                        </button>
                    )
                })}

            </div>
        </div>
    );
}
