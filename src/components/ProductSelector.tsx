"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { ShoppingBag, Plus, ChefHat, Clock, AlertCircle } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import confetti from "canvas-confetti";
import Image from "next/image";
import { TiltCard } from "@/components/ui/TiltCard";

interface ProductSelectorProps {
    onSelect?: (productSlug: string) => void;
}

type Product = {
    id: number;
    name: string;
    description: string;
    base_price: number;
    type: string;
    category: string;
    slug: string;
    image_url: string;
    is_active: boolean;
};

// Order for fixed menu
const MENY_CATEGORY_ORDER = [
    'Pokes de la Casa',
    'Share & Smile',
    'Drinks',
    'Postres'
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.2,
            delayChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: "spring",
            stiffness: 70,
            damping: 15,
            mass: 0.8
        }
    }
} as any;

export default function ProductSelector({ onSelect }: ProductSelectorProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [webDisabled, setWebDisabled] = useState(false);

    const supabase = createClient();
    const { addToCart } = useCart();
    const { showToast } = useToast();

    useEffect(() => {
        const fetchMenu = async () => {
            setLoading(true);

            // Check global config first
            try {
                const { data: config } = await supabase
                    .from('app_config')
                    .select('value')
                    .eq('key', 'web_products_enabled')
                    .single();

                if (config && (config.value === false || config.value === 'false')) {
                    setWebDisabled(true);
                    setLoading(false);
                    return;
                } else {
                    setWebDisabled(false);
                }
            } catch (e) {
                console.error("Config check failed:", e);
                setWebDisabled(false);
            }

            const { data } = await supabase.from('products').select('*');
            if (data) setProducts(data);
            setLoading(false);
        };

        fetchMenu();

        // Realtime Subscription
        const channel = supabase.channel('product-selector-updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                () => fetchMenu()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // 1. Extract Heroes (Custom Builders)
    const customBowls = products.filter(p => p.category === 'bowls' || p.type === 'poke');

    const handleBuilderSelect = (product: Product) => {
        if (!product.is_active) {
            showToast('🚫 Producto no disponible por el momento.', 'error');
            return;
        }
        if (onSelect) onSelect(product.slug);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-300 animate-pulse">Cargando menú delicioso...</div>;

    if (webDisabled) {
        return (
            <section id="product-selector" className="min-h-[40vh] bg-white flex items-center justify-center p-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center max-w-lg"
                >
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-400">
                        <Clock size={32} />
                    </div>
                    <h2 className="text-3xl font-serif font-black text-slate-900 mb-4">Experiencia en Pausa</h2>
                    <p className="text-slate-500 font-medium mb-6">
                        Estamos preparando nuevas sorpresas para nuestros armadores.
                        Vuelve pronto para crear tu combinación perfecta.
                    </p>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-full inline-block">
                        Mantenimiento del Catálogo
                    </div>
                </motion.div>
            </section>
        );
    }

    return (
        <section id="product-selector" className="min-h-screen bg-gradient-to-b from-yoko-light via-white to-yoko-light relative overflow-hidden pb-40">
            {/* --- HERO SECTION: BUILD YOUR OWN --- */}
            <div className="bg-white/80 backdrop-blur-sm pb-12 pt-24 rounded-b-[3rem] shadow-xl shadow-yoko-primary/5 mb-16 relative overflow-hidden">
                {/* Decor */}
                <div className="absolute top-0 right-0 w-1/2 h-full bg-yoko-light/50 skew-x-12 transform origin-top-right pointer-events-none" />

                <motion.div
                    className="max-w-7xl mx-auto px-4 relative z-10 text-center"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: false, margin: "-100px" }}
                >
                    <motion.div
                        variants={itemVariants}
                        className="mb-12"
                    >
                        <span className="text-xs font-bold tracking-[0.2em] text-violet-600 uppercase mb-2 block">Experiencia Yoko</span>
                        <h2 className="text-5xl md:text-7xl font-serif font-black text-slate-900 mb-4 tracking-tight">
                            Arma tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">Favorito</span>
                        </h2>
                        <p className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mx-auto">
                            Elige los ingredientes frescos que más te gusten y crea una obra maestra culinaria.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                        {customBowls.map((product) => {
                            const emoji = product.type === 'burger' ? '🍔' : '🥗';
                            const actionText = product.type === 'burger' ? 'Armar Burger' : 'Armar Bowl';

                            return (
                                <motion.div key={product.id} variants={itemVariants}>
                                    <TiltCard
                                        onClick={() => handleBuilderSelect(product)}
                                        className={`bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden h-full flex flex-col justify-between ${!product.is_active ? 'opacity-60 grayscale' : ''}`}
                                    >
                                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-green-50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />

                                        <div className="relative z-10 flex flex-col items-center flex-1">
                                            <motion.span
                                                className="text-8xl mb-6 block pb-4"
                                                whileHover={{ rotate: 15, scale: 1.15 }}
                                                transition={{ type: "spring", stiffness: 200 }}
                                            >
                                                {emoji}
                                            </motion.span>
                                            <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-2 text-center leading-tight">{product.name}</h3>
                                            <p className="text-sm md:text-base text-slate-500 font-medium mb-6 text-center line-clamp-3 px-2">{product.description || 'Base de arroz + Proteína + Toppings ilimitados'}</p>

                                            {!product.is_active && (
                                                <div className="mb-4 px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold uppercase rounded-full">
                                                    No disponible
                                                </div>
                                            )}

                                            <div className="mt-auto">
                                                <button className={`bg-slate-900 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-colors shadow-lg shadow-slate-900/20 ${product.is_active ? 'group-hover:bg-green-600 group-hover:shadow-green-600/30' : 'bg-slate-400 cursor-not-allowed'}`}>
                                                    <ChefHat size={20} /> {actionText}
                                                </button>
                                            </div>
                                        </div>
                                    </TiltCard>
                                </motion.div>
                            );
                        })}
                    </div>

                    {customBowls.length === 0 && !loading && (
                        <div className="text-center text-slate-400 py-12">
                            <p>No hay pokes personalizables disponibles en este momento.</p>
                        </div>
                    )}
                </motion.div>
            </div>
        </section>
    );
}
