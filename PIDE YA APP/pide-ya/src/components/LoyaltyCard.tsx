"use client";

import { motion } from "framer-motion";
import { Check, Gift, Truck, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface LoyaltyCardProps {
    stamps: number; // 0 to 6
    loading?: boolean;
}

export function LoyaltyCard({ stamps, loading }: LoyaltyCardProps) {
    const totalSlots = 6;
    const slots = Array.from({ length: totalSlots }, (_, i) => i + 1);
    const isRewardUnlocked = stamps >= 6;

    return (
        <div className="w-full relative">
            <Card className="rounded-[2rem] border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.08)] overflow-hidden">
                <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Mi Tarjeta</h2>
                            <p className="text-slate-500 text-sm font-medium">Mandaditos Premium</p>
                        </div>
                        <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center border border-orange-100">
                            <Star className="w-6 h-6 text-orange-500 fill-orange-500" />
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-3 gap-4 relative z-10">
                        {slots.map((slot) => {
                            const isFilled = stamps >= slot;
                            return (
                                <motion.div
                                    key={slot}
                                    initial={false}
                                    animate={{
                                        backgroundColor: isFilled ? "#ea580c" : "rgba(241, 245, 249, 1)", // orange-600 or slate-100
                                        scale: isFilled ? 1 : 1,
                                    }}
                                    className={cn(
                                        "aspect-square rounded-2xl flex items-center justify-center transition-all duration-500 relative overflow-hidden group",
                                        !isFilled && "border border-slate-200"
                                    )}
                                >
                                    {isFilled ? (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                        >
                                            <Truck className="w-7 h-7 text-white" strokeWidth={2.5} />
                                            {/* Shine effect */}
                                            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                        </motion.div>
                                    ) : (
                                        <span className="text-slate-300 font-bold text-lg">{slot}</span>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Progress & Status */}
                    <div className="mt-8">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Progreso</span>
                            <span className="text-2xl font-black text-slate-900">{stamps}<span className="text-slate-300 text-lg font-normal">/6</span></span>
                        </div>

                        {/* Custom Progress Bar */}
                        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden p-1">
                            <motion.div
                                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full shadow-lg shadow-orange-500/30"
                                initial={{ width: 0 }}
                                animate={{ width: `${(stamps / 6) * 100}%` }}
                                transition={{ duration: 0.8, ease: "circOut" }}
                            />
                        </div>
                    </div>

                    {/* Reward Unlocked Banner */}
                    {isRewardUnlocked && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-4 flex items-center justify-center gap-3 text-white shadow-lg shadow-green-500/30"
                        >
                            <Gift className="w-6 h-6 animate-bounce" />
                            <span className="font-bold tracking-wide">¡ENVÍO GRATIS!</span>
                        </motion.div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
