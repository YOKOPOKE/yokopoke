"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, ShoppingBag, ArrowRight, CheckCircle, MessageCircle } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { createClient } from '@/lib/supabase';

export default function CartDrawer() {
    const { isCartOpen, toggleCart, items, removeFromCart, cartTotal, clearCart } = useCart();
    const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
    const [customer, setCustomer] = useState({ name: '', address: '', phone: '', payment: 'Efectivo' });

    // Reset step when closed
    React.useEffect(() => {
        if (!isCartOpen) setTimeout(() => setStep('cart'), 300);
    }, [isCartOpen]);

    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    // Import supabase client
    const supabase = createClient();

    const handleCheckout = () => {
        if (items.length === 0) return;
        setStep('checkout');
    };

    const handlePlaceOrder = async () => {
        setIsPlacingOrder(true);

        try {
            // 1. Save to Supabase
            const { error } = await supabase.from('orders').insert({
                customer_name: customer.name,
                total: cartTotal,
                status: 'pending',
                delivery_method: customer.address.toLowerCase().includes('recoger') ? 'pickup' : 'delivery',
                items: items, // Save full JSON
                // Store extra details in a JSON column if needed, or stick to schema
                // For now assuming 'items' column handles the JSON blob
            });

            if (error) {
                console.error('Error saving order:', error);
                alert('Hubo un error al guardar tu pedido. Por favor intenta de nuevo.');
                setIsPlacingOrder(false);
                return;
            }

            // 2. Construct WhatsApp Message (If DB save success)
            let message = `*¡Nuevo Pedido YOKO!* 🥗✨\n\n`;
            message += `*Cliente:* ${customer.name}\n`;
            message += `*Dirección:* ${customer.address}\n`;
            message += `*Teléfono:* ${customer.phone}\n`;
            message += `*Pago:* ${customer.payment}\n\n`;
            message += `*--- PEDIDO ---*\n`;

            items.forEach((item, idx) => {
                message += `\n*${idx + 1}. ${item.productType === 'bowl' ? 'Poke Bowl' : 'Sushi Burger'} (${item.size || 'Regular'})* - $${item.price}\n`;
                if (item.base) message += `   Base: ${item.base.name}\n`;

                const ingredients = [
                    ...item.proteins,
                    ...item.mixins,
                    ...item.sauces,
                    ...item.toppings,
                    ...item.extras
                ];

                if (ingredients.length > 0) {
                    message += `   Ingredientes: ${ingredients.map(i => i.name).join(', ')}\n`;
                }
            });

            message += `\n*TOTAL: $${cartTotal}*\n`;
            message += `\n_Enviado desde la web_`;

            window.open(`https://wa.me/529631758062?text=${encodeURIComponent(message)}`, '_blank');

            clearCart();
            setStep('success');
        } catch (err) {
            console.error('Unexpected error:', err);
            alert('Error inesperado. Intenta de nuevo.');
        } finally {
            setIsPlacingOrder(false);
        }
    };

    return (
        <AnimatePresence>
            {isCartOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={toggleCart}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col border-l border-gray-100"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white relative z-10">
                            <h2 className="text-2xl font-serif font-bold text-yoko-dark flex items-center gap-2">
                                {step === 'cart' && <>🛍️ Tu Carrito <span className="text-sm bg-green-100 text-yoko-primary px-2 py-0.5 rounded-full">{items.length}</span></>}
                                {step === 'checkout' && <>📝 Datos de Envío</>}
                                {step === 'success' && <>🎉 ¡Orden Enviada!</>}
                            </h2>
                            <button onClick={toggleCart} className="p-2 hover:bg-gray-50 rounded-full transition">
                                <X size={24} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50/50">
                            {step === 'cart' && (
                                <div className="space-y-4">
                                    {items.length === 0 ? (
                                        <div className="text-center py-20 opacity-50">
                                            <ShoppingBag size={64} className="mx-auto mb-4 text-gray-300" />
                                            <p className="text-lg font-bold text-gray-400">Tu carrito está vacío</p>
                                            <p className="text-sm text-gray-400">¡Arma tu bowl perfecto!</p>
                                        </div>
                                    ) : (
                                        items.map(item => (
                                            <motion.div
                                                layout
                                                key={item.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -100 }}
                                                className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex gap-4"
                                            >
                                                <div className="text-3xl bg-green-50 w-16 h-16 rounded-lg flex items-center justify-center shrink-0">
                                                    {item.productType === 'bowl' ? '🥣' : '🍔'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="font-bold text-yoko-dark truncate">
                                                            {item.productType === 'bowl' ? 'Poke Bowl' : 'Sushi Burger'}
                                                        </h4>
                                                        <span className="font-bold text-yoko-primary">${item.price}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mb-2">{item.size || 'Regular'}</p>

                                                    <div className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                                                        {item.base && <span className="mr-1">Base: {item.base.name}.</span>}
                                                        {[...item.proteins, ...item.mixins].map(i => i.name).join(', ')}...
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="text-gray-300 hover:text-red-500 transition-colors self-center p-2"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            )}

                            {step === 'checkout' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-4"
                                >
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
                                        <input
                                            type="text"
                                            value={customer.name}
                                            onChange={e => setCustomer({ ...customer, name: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-yoko-primary focus:border-transparent outline-none"
                                            placeholder="Tu nombre completo"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dirección / Notas</label>
                                        <textarea
                                            value={customer.address}
                                            onChange={e => setCustomer({ ...customer, address: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-yoko-primary focus:border-transparent outline-none h-24 resize-none"
                                            placeholder="Dirección de entrega o 'Recoger en tienda'"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Teléfono</label>
                                        <input
                                            type="tel"
                                            value={customer.phone}
                                            onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-yoko-primary focus:border-transparent outline-none"
                                            placeholder="Para contactarte"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Método de Pago</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['Efectivo', 'Transferencia'].map(method => (
                                                <button
                                                    key={method}
                                                    onClick={() => setCustomer({ ...customer, payment: method })}
                                                    className={`p-3 rounded-lg text-sm font-bold border transition-all ${customer.payment === method ? 'bg-yoko-primary text-white border-yoko-primary' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                                >
                                                    {method}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {step === 'success' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-20"
                                >
                                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <CheckCircle size={48} className="text-yoko-primary" />
                                    </div>
                                    <h3 className="text-2xl font-serif font-bold text-yoko-dark mb-2">¡Pedido Enviado!</h3>
                                    <p className="text-gray-500 mb-8">Te redirigimos a WhatsApp para confirmar.</p>
                                    <button onClick={toggleCart} className="text-yoko-primary font-bold hover:underline">
                                        Cerrar y seguir viendo
                                    </button>
                                </motion.div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        {step !== 'success' && (
                            <div className="p-6 border-t border-gray-100 bg-white z-10 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                                <div className="flex justify-between items-end mb-4">
                                    <span className="text-gray-500 font-medium">Total</span>
                                    <span className="text-3xl font-serif font-bold text-yoko-dark">${cartTotal}</span>
                                </div>

                                {step === 'cart' ? (
                                    <button
                                        onClick={handleCheckout}
                                        disabled={items.length === 0}
                                        className="w-full bg-yoko-dark hover:bg-black text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Finalizar Compra <ArrowRight size={20} />
                                    </button>
                                ) : (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setStep('cart')}
                                            className="px-6 py-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition"
                                        >
                                            Atrás
                                        </button>
                                        <button
                                            onClick={handlePlaceOrder}
                                            disabled={!customer.name || !customer.phone || isPlacingOrder}
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isPlacingOrder ? <span className="animate-spin">⏳</span> : <MessageCircle size={20} />}
                                            {isPlacingOrder ? 'Enviando...' : 'Enviar Pedido'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
