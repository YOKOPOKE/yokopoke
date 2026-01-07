"use client";

import { motion } from "framer-motion";
import { Edit, MessageCircle, Star } from "lucide-react";
import Image from "next/image";

export default function Hero() {
    return (
        <section
            id="inicio"
            className="relative pt-32 pb-20 px-4 min-h-[95vh] lg:min-h-screen flex items-center overflow-hidden"
        >
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-hero-pattern opacity-5 z-0"></div>

            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-[500px] lg:w-[800px] h-[500px] lg:h-[800px] bg-green-100/50 rounded-full blur-[80px] lg:blur-[100px] opacity-40 -translate-y-1/2 translate-x-1/2 z-0 animate-pulse"></div>

            {/* Parallax Elements (Simplified CSS animation for now, could be mouse-aware) */}
            <div className="absolute top-20 left-10 text-4xl opacity-20 hidden lg:block animate-float" style={{ animationDelay: '0s' }}>🥗</div>
            <div className="absolute bottom-40 left-1/4 text-6xl opacity-10 hidden lg:block text-yoko-primary animate-float" style={{ animationDelay: '1s' }}>🌿</div>
            <div className="absolute top-1/3 right-10 text-3xl opacity-20 hidden lg:block animate-float" style={{ animationDelay: '2s' }}>🥑</div>

            <div className="max-w-7xl mx-auto w-full flex flex-col lg:grid lg:grid-cols-12 gap-8 lg:gap-16 items-center relative z-10 pt-10 lg:pt-0">

                {/* Text Content */}
                <div className="w-full lg:col-span-6 flex flex-col justify-center items-center lg:items-start text-center lg:text-left order-1">

                    <motion.span
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="inline-block py-1 px-3 rounded-full bg-orange-100 text-yoko-accent text-xs font-bold uppercase tracking-widest mb-4 w-fit"
                    >
                        📍 Comitán, Chiapas
                    </motion.span>

                    <h1 className="text-5xl lg:text-8xl font-serif font-bold text-yoko-dark mb-4 leading-tight">
                        <motion.span
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                            className="block"
                        >
                            YOKO
                        </motion.span>
                        <motion.span
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
                            className="block"
                        >
                            POKE
                        </motion.span>
                        <motion.span
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}
                            className="block text-yoko-accent"
                        >
                            HOUSE
                        </motion.span>
                    </h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                        className="text-lg lg:text-2xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0"
                    >
                        Tu bowl, tus reglas. Ingredientes frescos, combinaciones infinitas.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1 }}
                        className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4"
                    >
                        <a href="#product-selector" className="btn-ripple bg-yoko-primary text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-yoko-dark transition shadow-xl hover:shadow-2xl hover:-translate-y-1 inline-flex items-center justify-center gap-2">
                            <Edit className="w-5 h-5" /> Armar mi Bowl
                        </a>
                        <a href="https://wa.me/5219631371902" target="_blank" className="btn-ripple bg-white text-yoko-dark border-2 border-yoko-dark px-8 py-4 rounded-full font-bold text-lg hover:bg-yoko-light transition shadow-lg hover:shadow-xl hover:-translate-y-1 inline-flex items-center justify-center gap-2">
                            <MessageCircle className="w-5 h-5" /> Pedir por WhatsApp
                        </a>
                    </motion.div>
                </div>

                {/* Image Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    className="w-full lg:col-span-6 relative flex justify-center lg:justify-end items-center order-2"
                >
                    <div className="relative w-72 h-72 lg:w-96 lg:h-96 mx-auto animate-float">

                        {/* Spinning Ring */}
                        <div className="absolute inset-0 animate-spin-slow opacity-20 pointer-events-none">
                            <svg viewBox="0 0 100 100" width="100%" height="100%">
                                <path id="curve" d="M 50 50 m -37 0 a 37 37 0 1 1 74 0 a 37 37 0 1 1 -74 0" fill="transparent" />
                                <text width="500">
                                    <textPath xlinkHref="#curve" className="text-[8px] font-bold uppercase tracking-[0.2em]" fill="currentColor">
                                        • Ingredientes Frescos • Bowl Saludable • Yoko Poke House
                                    </textPath>
                                </text>
                            </svg>
                        </div>

                        {/* Main Image */}
                        <div className="absolute inset-4 lg:inset-4 w-[calc(100%-32px)] lg:w-[calc(100%-32px)] h-[calc(100%-32px)] lg:h-[calc(100%-32px)] rounded-full shadow-2xl border-4 lg:border-8 border-white overflow-hidden">
                            <img
                                src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=90"
                                alt="Yoko Poke Bowl"
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {/* Floating Ratings Card */}
                        <motion.div
                            initial={{ x: 50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 1.2 }}
                            className="hidden lg:block absolute top-10 -right-4 bg-white p-4 rounded-2xl shadow-xl z-20"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-orange-100 p-2 rounded-full text-yoko-accent">
                                    <Star className="w-4 h-4 fill-current" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase">Valoración</p>
                                    <p className="font-bold text-yoko-dark">4.9/5 Estrellas</p>
                                </div>
                            </div>
                        </motion.div>

                    </div>
                </motion.div>
            </div>
        </section>
    );
}
