"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu as MenuIcon, X, ShoppingBag, Edit3 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('inicio');
    const { toggleCart, cartCount } = useCart();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);

            // Scroll Spy Logic
            const sections = ['inicio', 'menu', 'ubicacion'];
            for (const section of sections) {
                const element = document.getElementById(section);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    // If the top of the section is near the top of viewport (w/ navbar offset)
                    // and it'still has content visible
                    if (rect.top <= 150 && rect.bottom >= 150) {
                        setActiveSection(section);
                        break; // Stop at first match (top-down)
                    }
                }
            }
        };

        window.addEventListener("scroll", handleScroll);
        // Trigger once on mount
        handleScroll();

        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <>
            <nav
                className={`fixed w-full z-50 transition-all duration-300 ${isScrolled
                    ? "bg-white/95 backdrop-blur-md shadow-sm h-20"
                    : "bg-transparent h-24"
                    }`}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
                    <div className="flex justify-between items-center h-full">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="relative w-12 h-12">
                                <svg
                                    viewBox="0 0 100 100"
                                    className="w-full h-full transform group-hover:rotate-12 transition duration-500"
                                >
                                    <circle cx="50" cy="50" r="48" fill="#2F5233" />
                                    <path
                                        d="M20,50 Q50,20 80,50 T20,50"
                                        fill="none"
                                        stroke="#FF6B6B"
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                    />
                                    <circle cx="50" cy="50" r="35" fill="#F7F9F5" />
                                    <path
                                        d="M35,60 Q50,80 65,60"
                                        fill="none"
                                        stroke="#2F5233"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d="M35,45 L45,45 M55,45 L65,45"
                                        stroke="#2F5233"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d="M80,20 L90,10"
                                        stroke="#FF6B6B"
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-serif font-bold text-2xl tracking-tighter text-yoko-dark leading-none">
                                    YOKO
                                </span>
                                <span className="text-[0.6rem] font-bold text-yoko-accent tracking-[0.3em] uppercase">
                                    Poke House
                                </span>
                            </div>
                        </Link>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center space-x-10">
                            {['Inicio', 'Menú', 'Ubicación'].map((item) => {
                                const id = item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                const isActive = activeSection === id;
                                return (
                                    <Link
                                        key={item}
                                        href={`#${id}`}
                                        className={`text-sm font-semibold uppercase tracking-wide transition relative group ${isActive ? 'text-yoko-accent' : 'text-yoko-dark hover:text-yoko-accent'
                                            }`}
                                    >
                                        {item}
                                        <span className={`absolute -bottom-1 left-0 h-0.5 bg-yoko-accent transition-all duration-300 ${isActive ? 'w-full' : 'w-0 group-hover:w-full'
                                            }`}></span>
                                    </Link>
                                );
                            })}
                            <button
                                onClick={toggleCart} // Connect toggle
                                className="bg-white text-yoko-dark border border-gray-200 p-3 rounded-full hover:bg-gray-50 transition shadow-sm hover:shadow-md ml-2 relative group"
                                aria-label="Ver Carrito"
                            >
                                <ShoppingBag className="w-5 h-5" />
                                {cartCount > 0 && ( // Show badge only if items > 0
                                    <span className="absolute -top-1 -right-1 bg-yoko-primary text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                                        {cartCount}
                                    </span>
                                )}
                            </button>
                            <button
                                className="bg-yoko-dark text-white px-8 py-3 rounded-full font-bold hover:bg-yoko-accent transition shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center gap-2 text-sm uppercase tracking-wider"
                            >
                                <Edit3 className="w-4 h-4" /> Armar Bowl
                            </button>
                        </div>

                        {/* Mobile Actions (Cart + Toggle) */}
                        <div className="flex items-center gap-4 lg:hidden">
                            <button
                                onClick={toggleCart}
                                className="text-yoko-dark relative p-2"
                                aria-label="Ver Carrito"
                            >
                                <ShoppingBag className="w-6 h-6" />
                                {cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-yoko-primary text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                                        {cartCount}
                                    </span>
                                )}
                            </button>

                            <button
                                className="text-yoko-dark focus:outline-none"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            >
                                {isMobileMenuOpen ? <X size={28} /> : <MenuIcon size={28} />}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, clipPath: "circle(0px at calc(100% - 40px) 40px)" }}
                        animate={{ opacity: 1, clipPath: "circle(150% at calc(100% - 40px) 40px)" }}
                        exit={{ opacity: 0, clipPath: "circle(0px at calc(100% - 40px) 40px)" }}
                        transition={{ duration: 0.5, type: "spring", damping: 20 }}
                        className="fixed inset-0 z-40 bg-yoko-dark flex flex-col items-center justify-center space-y-8 lg:hidden"
                    >
                        {['Inicio', 'Menú', 'Ubicación'].map((item) => (
                            <a
                                key={item}
                                href={`#${item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}
                                className="text-2xl font-serif font-bold text-white hover:text-yoko-accent transition"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                {item}
                            </a>
                        ))}
                        <button
                            className="bg-yoko-accent text-white px-8 py-4 rounded-full font-bold shadow-xl flex items-center gap-2 text-lg uppercase tracking-wider"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <Edit3 className="w-5 h-5" /> Armar Bowl
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
