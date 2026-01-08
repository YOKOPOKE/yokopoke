"use client";

import { useCart } from '@/context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Trash2, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import StripeCheckoutModal from './StripeCheckoutModal';

type Tab = 'cart' | 'checkout' | 'success';

export default function CartDrawer() {
    const { items, isCartOpen, toggleCart, removeFromCart, cartTotal, clearCart } = useCart();
    const [step, setStep] = useState<Tab>('cart');
    const [formData, setFormData] = useState({
        name: '', phone: '', address: '', instructions: ''
    });
    const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery'); // New State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    // Apple-style spring transition
    const springTransition = {
        type: "spring",
        stiffness: 500, // Increased stiffness for speed
        damping: 30,    // Reduced damping for snappier feel (less "drag")
        mass: 1
    } as any;

    if (!isCartOpen) return null;

    const handleCheckout = () => {
        setStep('checkout');
    };



    return (
        <AnimatePresence mode="wait">
            {isCartOpen && (
                <>
                    {/* Backdrop (Only visible when NOT in full-screen payment mode) */}
                    {!clientSecret && (
                        <motion.div
                            key="cart-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={toggleCart}
                            className="fixed inset-0 bg-black/40 z-[60]"
                            style={{ willChange: "opacity" }}
                        />
                    )}

                    {/* Drawer Container */}
                    <motion.div
                        key="cart-drawer"
                        layout // Enables smooth layout transition to full screen
                        initial={{ x: '100%' }}
                        animate={{
                            x: 0,
                            width: clientSecret ? '100%' : '100%', // Animate width but keep constraints
                        }}
                        exit={{ x: '100%' }}
                        transition={springTransition}
                        // Dynamic class: 'fixed inset-0 w-full max-w-none' for full screen, 'right-0 max-w-md' for drawer
                        className={`fixed bg-white shadow-2xl z-[70] flex flex-col border-l border-gray-100 will-change-transform ${clientSecret
                            ? "inset-0 w-full max-w-none"
                            : "inset-0 sm:inset-auto sm:right-0 sm:top-0 sm:bottom-0 w-full sm:max-w-md"
                            }`}
                        style={{ willChange: "transform, width, max-width" }}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white relative z-10 shrink-0">
                            <div className="flex-1">
                                {clientSecret ? (
                                    <h2 className="text-xl font-bold text-yoko-dark flex items-center gap-2">💳 Pago Seguro</h2>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        {/* Stepper Steps */}
                                        <div className={`flex items-center gap-2 transition-colors ${step === 'cart' ? 'text-yoko-dark font-bold' : 'text-gray-400'}`}>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'cart' ? 'bg-yoko-primary text-white' : 'bg-gray-100'}`}>1</div>
                                            <span className={`${step !== 'cart' && 'hidden sm:inline'}`}>Carrito</span>
                                        </div>
                                        <div className="w-8 h-[1px] bg-gray-200"></div>
                                        <div className={`flex items-center gap-2 transition-colors ${step === 'checkout' ? 'text-yoko-dark font-bold' : 'text-gray-400'}`}>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'checkout' ? 'bg-yoko-primary text-white' : 'bg-gray-100'}`}>2</div>
                                            <span className={`${step !== 'checkout' && 'hidden sm:inline'}`}>Datos</span>
                                        </div>
                                        <div className="w-8 h-[1px] bg-gray-200"></div>
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-gray-100">3</div>
                                            <span className="hidden sm:inline">Pago</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    if (clientSecret) {
                                        setShowExitConfirm(true);
                                    } else {
                                        toggleCart();
                                    }
                                }}
                                className="p-2 hover:bg-gray-50 rounded-full transition active:scale-95"
                            >
                                <X size={24} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Custom Exit Confirmation Modal */}
                        <AnimatePresence>
                            {showExitConfirm && (
                                <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                                    <motion.div
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.9, opacity: 0 }}
                                        className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full text-center border border-gray-100"
                                    >
                                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <X className="text-red-500" size={24} />
                                        </div>
                                        <h3 className="font-bold text-lg mb-2 text-yoko-dark">¿Cancelar proceso?</h3>
                                        <p className="text-gray-500 text-sm mb-6">Si sales ahora, se perderá el progreso del pago.</p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setShowExitConfirm(false)}
                                                className="flex-1 py-3 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                                            >
                                                Continuar
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setClientSecret(null);
                                                    setShowExitConfirm(false);
                                                }}
                                                className="flex-1 py-3 font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition"
                                            >
                                                Salir
                                            </button>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50 relative">
                            {/* Normal Cart Flow */}
                            {!clientSecret && (
                                <div className="p-6">
                                    {step === 'cart' && (
                                        <div className="space-y-4">
                                            {items.length === 0 ? (
                                                <div className="text-center py-20 opacity-50">
                                                    <ShoppingBag size={64} className="mx-auto mb-4 text-gray-300" />
                                                    <p className="text-lg font-bold text-gray-400">Tu carrito está vacío</p>
                                                    <p className="text-sm text-gray-400">¡Arma tu bowl perfecto!</p>
                                                </div>
                                            ) : (
                                                <AnimatePresence mode="popLayout">
                                                    {items.map(item => (
                                                        <motion.div
                                                            layout
                                                            key={item.id}
                                                            initial={{ opacity: 0, scale: 0.95 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                                            className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex gap-4"
                                                            style={{ willChange: "transform, opacity" }}
                                                        >
                                                            <div className="text-3xl bg-green-50 w-16 h-16 rounded-lg flex items-center justify-center shrink-0">
                                                                {item.productType === 'bowl' ? '🥣' : '🍔'}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between items-start">
                                                                    <h4 className="font-bold text-yoko-dark truncate">
                                                                        {item.name || (item.productType === 'bowl' ? 'Poke Bowl' : 'Sushi Burger')}
                                                                    </h4>
                                                                    <div className="text-right">
                                                                        <div className="font-bold text-yoko-primary">${item.price}</div>
                                                                        {item.priceBreakdown && item.priceBreakdown.extras > 0 && (
                                                                            <div className="text-[10px] text-gray-400 font-medium">
                                                                                Base ${item.priceBreakdown.base} + ${item.priceBreakdown.extras}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <p className="text-xs text-gray-500 mb-2">{item.size || 'Regular'}</p>

                                                                <div className="text-xs text-gray-600 space-y-1">
                                                                    {item.details ? (
                                                                        item.details.map((d, i) => (
                                                                            <div key={i} className="line-clamp-2">
                                                                                <span className="font-semibold text-gray-700">{d.label}:</span> {d.value}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        // Legacy Layout
                                                                        <>
                                                                            {item.base && <div>Base: {item.base.name}</div>}
                                                                            <div>
                                                                                {[
                                                                                    ...(item.proteins || []),
                                                                                    ...(item.mixins || [])
                                                                                ].map(i => i.name).join(', ')}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => removeFromCart(item.id)}
                                                                className="text-gray-300 hover:text-red-500 transition-colors self-center p-2 active:scale-95"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </motion.div>
                                                    ))}
                                                </AnimatePresence>
                                            )}
                                        </div>
                                    )}

                                    {step === 'checkout' && (
                                        <motion.div
                                            key="checkout-step"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.2 }}
                                            className="space-y-4"
                                        >
                                            {/* Order Type Toggle */}
                                            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                                                <button
                                                    onClick={() => setOrderType('delivery')}
                                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${orderType === 'delivery' ? 'bg-white text-yoko-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                >
                                                    🛵 A Domicilio
                                                </button>
                                                <button
                                                    onClick={() => setOrderType('pickup')}
                                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${orderType === 'pickup' ? 'bg-white text-yoko-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                >
                                                    🏪 Recoger
                                                </button>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre</label>
                                                <input
                                                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    className="w-full p-3 rounded-xl border border-gray-200 focus:border-yoko-primary focus:ring-2 focus:ring-green-100 outline-none transition"
                                                    placeholder="Tu nombre"
                                                />
                                            </div>

                                            {/* Address / Pickup Info */}
                                            {orderType === 'delivery' ? (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                >
                                                    <label className="block text-sm font-bold text-gray-700 mb-1">Dirección</label>
                                                    <input
                                                        value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                                                        className="w-full p-3 rounded-xl border border-gray-200 focus:border-yoko-primary focus:ring-2 focus:ring-green-100 outline-none transition"
                                                        placeholder="Calle, número, colonia..."
                                                    />
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="bg-green-50 p-4 rounded-xl border border-green-100 text-sm text-green-800"
                                                >
                                                    <p className="font-bold flex items-center gap-2">📍 Yoko Poke House</p>
                                                    <p>Calle Central Pte. 54, Guadalupe</p>
                                                    <p>Comitán de Domínguez, Chis.</p>
                                                </motion.div>
                                            )}

                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Teléfono (10 dígitos)</label>
                                                <input
                                                    type="tel"
                                                    value={formData.phone}
                                                    onChange={e => {
                                                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                        setFormData({ ...formData, phone: val });
                                                    }}
                                                    className="w-full p-3 rounded-xl border border-gray-200 focus:border-yoko-primary focus:ring-2 focus:ring-green-100 outline-none transition"
                                                    placeholder="Ej: 6671234567"
                                                    inputMode="numeric"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Instrucciones / Nota</label>
                                                <textarea
                                                    value={formData.instructions} onChange={e => setFormData({ ...formData, instructions: e.target.value })}
                                                    className="w-full p-3 rounded-xl border border-gray-200 focus:border-yoko-primary focus:ring-2 focus:ring-green-100 outline-none transition"
                                                    placeholder={orderType === 'delivery' ? "¿Sin cebolla? ¿Salsa extra?" : "Hora aproximada de recolección..."}
                                                    rows={3}
                                                />
                                            </div>
                                        </motion.div>
                                    )}

                                    {step === 'success' && (
                                        <div className="text-center py-20">
                                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                                <ShoppingBag className="text-yoko-primary" size={32} />
                                            </div>
                                            <h3 className="text-2xl font-bold text-yoko-dark mb-2">¡Pedido Listo!</h3>
                                            <p className="text-gray-500 mb-8">
                                                Te estamos redirigiendo a WhatsApp para confirmar...<br />
                                                <span className="text-xs text-gray-400">(Si no abre, revisa tus pop-ups)</span>
                                            </p>
                                            <button onClick={toggleCart} className="text-yoko-primary font-bold hover:underline">
                                                Cerrar ventana
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Payment Flow (Full Screen In-Place) */}
                            {clientSecret && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="h-full w-full flex flex-col"
                                >
                                    <StripeCheckoutModal
                                        clientSecret={clientSecret}
                                        onClose={() => setClientSecret(null)}
                                    />
                                </motion.div>
                            )}
                        </div>

                        {/* Footer (Only visible when NOT in payment mode or success) */}
                        {!clientSecret && step !== 'success' && (
                            <div className="p-6 bg-white border-t border-gray-100 shrink-0">
                                {step === 'cart' ? (
                                    <div className="space-y-4">
                                        <div className="flex justify-between text-lg font-bold text-yoko-dark">
                                            <span>Total</span>
                                            <span>${cartTotal}</span>
                                        </div>
                                        <button
                                            onClick={handleCheckout}
                                            disabled={items.length === 0}
                                            className="w-full bg-yoko-primary hover:bg-yoko-dark text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-200 active:scale-[0.98]"
                                        >
                                            Continuar <ArrowRight size={20} />
                                        </button>
                                        <div className="text-center">
                                            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Horario de Atención</span>
                                            <p className="text-xs text-gray-500 font-medium">Lun-Dom: 1:00 PM - 11:00 PM</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">


                                        <button
                                            onClick={async () => {
                                                if (isSubmitting) return;
                                                // Prevent Stripe payment for Pickup if desired? Or allow it? 
                                                // Assuming allowed for now, but logical address check needed.

                                                setIsSubmitting(true);
                                                try {
                                                    // Auto-fill address for pickup to pass validation if empty
                                                    const finalAddress = orderType === 'pickup' ? 'RECOGER EN TIENDA' : formData.address;

                                                    // 1. Save Order First
                                                    const { submitOrder } = await import('@/app/actions/submitOrder');
                                                    const result = await submitOrder({ ...formData, address: finalAddress }, items, cartTotal);

                                                    if (!result.success) throw new Error(result.error);

                                                    // 2. Create Checkout Session (Embedded)
                                                    const response = await fetch('/api/checkout', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            items,
                                                            orderId: result.orderId,
                                                        }),
                                                    });

                                                    if (!response.ok) {
                                                        const errorText = await response.text();
                                                        throw new Error(`Error del servidor: ${errorText}`);
                                                    }

                                                    const data = await response.json();

                                                    if (data.clientSecret) {
                                                        setClientSecret(data.clientSecret);
                                                        setIsSubmitting(false); // Stop loading to show modal
                                                    } else {
                                                        throw new Error('No se recibió el secreto de pago');
                                                    }

                                                } catch (err: any) {
                                                    console.error("Payment Error:", err);
                                                    alert(`⚠️ No se pudo iniciar el pago.\n\nDetalle: ${err.message || 'Error desconocido'}\n\nPor favor intenta de nuevo o elige pagar en efectivo/transferencia.`);
                                                    setIsSubmitting(false);
                                                }
                                            }}
                                            disabled={!formData.name || (orderType === 'delivery' && !formData.address) || formData.phone.length < 10 || isSubmitting}
                                            className="w-full bg-[#635BFF] hover:bg-[#4B44CC] text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
                                        >
                                            {isSubmitting ? 'Cargando...' : (
                                                <>💳 Pagar con Tarjeta <span className="text-xs font-normal opacity-80">(Stripe)</span></>
                                            )}
                                        </button>
                                        <button onClick={() => setStep('cart')} className="w-full text-gray-500 font-bold py-2">
                                            Volver al Carrito
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

