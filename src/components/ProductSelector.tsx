import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";

interface ProductSelectorProps {
    onSelect?: (product: string) => void;
}

type SizeOption = {
    id: number;
    name: string;
    base_price: number;
};

export default function ProductSelector({ onSelect }: ProductSelectorProps) {
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
    const [bowlSizes, setBowlSizes] = useState<SizeOption[]>([]);
    const [burgerPrice, setBurgerPrice] = useState<number>(180); // Fallback
    const [loading, setLoading] = useState(true);

    const supabase = createClient();

    useEffect(() => {
        const fetchPrices = async () => {
            const { data } = await supabase.from('sizes').select('*').order('base_price');
            if (data) {
                // Filter bowl sizes
                const bowls = data.filter((item: any) => item.name !== 'Sushi Burger');
                setBowlSizes(bowls);

                // Find burger price
                const burger = data.find((item: any) => item.name === 'Sushi Burger');
                if (burger) setBurgerPrice(burger.base_price);
            }
            setLoading(false);
        };
        fetchPrices();
    }, []);

    const handleSelect = (product: string) => {
        setSelectedProduct(product);
        if (onSelect) onSelect(product);
    };

    return (
        <section id="product-selector" className="h-[90vh] md:h-[80vh] min-h-[600px] flex flex-col items-center justify-center bg-white relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 right-0 w-1/3 h-full bg-yoko-light/30 skew-x-12 transform origin-top-right pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-yoko-accent/5 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 relative z-10 w-full">
                <div className="text-center mb-10 md:mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold text-yoko-dark mb-4 px-4 overflow-hidden">
                            ¿Qué se te antoja?
                        </h2>
                        <p className="text-gray-500 text-sm md:text-lg">Selecciona tu experiencia culinaria</p>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 max-w-5xl mx-auto">
                    {/* Poke Bowl Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1, type: "spring" }}
                        whileHover={{ y: -8, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelect('bowl')}
                        className={`cursor-pointer rounded-[2rem] p-8 lg:p-12 shadow-sm transition-all duration-300 border h-full flex flex-col items-center text-center relative overflow-hidden group
                ${selectedProduct === 'bowl'
                                ? 'border-yoko-primary bg-green-50 shadow-xl'
                                : 'border-gray-100 bg-white hover:border-green-200 hover:shadow-2xl hover:shadow-green-100/50'}
            `}
                    >
                        {selectedProduct === 'bowl' && (
                            <motion.div layoutId="active-border" className="absolute inset-0 border-[3px] border-yoko-primary rounded-[2rem] pointer-events-none" />
                        )}

                        <div className="relative mb-6">
                            <div className="text-6xl md:text-8xl lg:text-9xl transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 filter drop-shadow-sm">🥣</div>
                            <div className="absolute -inset-4 bg-yoko-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        <h3 className="text-2xl md:text-3xl font-serif font-bold text-yoko-dark mb-2">Poke Bowl</h3>
                        <p className="text-gray-500 mb-8 font-medium text-sm md:text-base">Arma tu bowl perfecto</p>

                        <div className="grid grid-cols-3 gap-3 w-full mt-auto">
                            {loading ? (
                                [1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)
                            ) : (
                                bowlSizes.map((size) => (
                                    <div key={size.id} className="bg-white border border-gray-100 rounded-xl py-2 px-1 flex flex-col items-center justify-center transition-colors group-hover:border-green-100">
                                        <span className="text-[10px] md:text-xs font-bold text-yoko-dark uppercase tracking-wider">{size.name}</span>
                                        <span className="text-sm md:text-base font-black text-yoko-primary">${size.base_price}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>

                    {/* Sushi Burger Card */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, type: "spring" }}
                        whileHover={{ y: -8, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelect('burger')}
                        className={`cursor-pointer rounded-[2rem] p-8 lg:p-12 shadow-sm transition-all duration-300 border h-full flex flex-col items-center text-center relative overflow-hidden group
                ${selectedProduct === 'burger'
                                ? 'border-yoko-primary bg-green-50 shadow-xl'
                                : 'border-gray-100 bg-white hover:border-red-200 hover:shadow-2xl hover:shadow-red-100/50'}
             `}
                    >
                        {selectedProduct === 'burger' && (
                            <motion.div layoutId="active-border" className="absolute inset-0 border-[3px] border-yoko-primary rounded-[2rem] pointer-events-none" />
                        )}

                        <div className="relative mb-6">
                            <div className="text-6xl md:text-8xl lg:text-9xl transform group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 filter drop-shadow-sm">🍔</div>
                            <div className="absolute -inset-4 bg-red-100/30 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        <h3 className="text-2xl md:text-3xl font-serif font-bold text-yoko-dark mb-2">Sushi Burger</h3>
                        <p className="text-gray-500 mb-8 font-medium text-sm md:text-base">Fusión única y crujiente</p>

                        <div className="w-full mt-auto">
                            {loading ? (
                                <div className="h-12 bg-gray-100 rounded-xl animate-pulse w-full" />
                            ) : (
                                <div className="w-full bg-white border border-gray-100 rounded-xl py-3 flex items-center justify-between px-6 transition-colors group-hover:border-red-100">
                                    <span className="text-xs font-bold text-yoko-dark uppercase tracking-wider">Regular</span>
                                    <span className="text-xl font-black text-yoko-accent">${burgerPrice}</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
