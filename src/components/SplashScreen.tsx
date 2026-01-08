"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat } from "lucide-react";

export default function SplashScreen() {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Hide splash screen after 2.5 seconds
        const timer = setTimeout(() => {
            setIsVisible(false);
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <AnimatePresence mode="wait">
            {isVisible && (
                <motion.div
                    key="splash-screen"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white will-change-opacity"
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                            duration: 0.6,
                            ease: "easeOut",
                            type: "spring",
                            bounce: 0.4
                        }}
                        className="flex flex-col items-center will-change-transform"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-violet-500 blur-[80px] opacity-20 rounded-full animate-pulse" />
                            <ChefHat size={80} className="text-violet-600 relative z-10 mb-4" strokeWidth={1.5} />
                        </div>

                        <motion.h1
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase will-change-transform"
                        >
                            Yoko Poke
                        </motion.h1>

                        <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: 0.4, duration: 0.6 }}
                            className="h-1 bg-violet-500 mt-4 rounded-full w-[100px] will-change-transform origin-left"
                        />

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7, duration: 0.4 }}
                            className="mt-4 text-slate-400 font-medium text-sm tracking-widest uppercase will-change-opacity"
                        >
                            Fresh & Delicious
                        </motion.p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
