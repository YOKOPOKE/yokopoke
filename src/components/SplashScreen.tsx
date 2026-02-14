"use client";

import { useEffect, useState } from "react";
import { useSplash } from "@/context/SplashContext";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen() {
    const [mount, setMount] = useState(true);
    const { setComplete } = useSplash();

    useEffect(() => {
        const timer = setTimeout(() => {
            setMount(false);
        }, 2200); // Slightly faster for snappier feel

        return () => clearTimeout(timer);
    }, []);

    return (
        <AnimatePresence
            mode="wait"
            onExitComplete={() => setComplete(true)} // Signal app ready on exit
        >
            {mount && (
                <motion.div
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white overflow-hidden"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeInOut" } }}
                >
                    <div className="relative flex flex-col items-center justify-center">

                        {/* 1. Main Logo Container */}
                        <motion.div
                            className="relative flex items-center justify-center mb-6"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} // Heavy Ease Out
                        >
                            {/* Circle Background Accent */}
                            <motion.div
                                className="absolute w-48 h-48 rounded-full bg-yoko-primary/10 blur-2xl"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1.5 }}
                                transition={{ duration: 1.2, delay: 0.2 }}
                            />

                            {/* Stylized Text Logo */}
                            <div className="relative z-10 flex flex-col items-center">
                                <motion.h1
                                    className="text-6xl md:text-8xl font-black tracking-tight text-slate-900 flex"
                                    initial={{ y: 20 }}
                                    animate={{ y: 0 }}
                                    transition={{ duration: 0.8 }}
                                >
                                    <motion.span
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3, duration: 0.5 }}
                                    >
                                        YOKO
                                    </motion.span>
                                    <motion.span
                                        className="text-yoko-primary ml-2"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.5, duration: 0.5 }}
                                    >
                                        POKE
                                    </motion.span>
                                </motion.h1>

                                <motion.div
                                    className="h-1 w-24 bg-yoko-primary mt-2 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: 96 }} // 6rem / 24 tailwind
                                    transition={{ delay: 0.8, duration: 0.6, ease: "circOut" }}
                                />

                                <motion.p
                                    className="text-xs md:text-sm font-bold tracking-[0.4em] text-slate-400 uppercase mt-4"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 1.0, duration: 0.5 }}
                                >
                                    Fresh & Premium
                                </motion.p>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
