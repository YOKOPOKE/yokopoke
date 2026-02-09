"use client";

import { useCart } from '@/context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Trash2, ArrowRight, Loader2, UtensilsCrossed, Bike, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import StripeCheckoutModal from './StripeCheckoutModal';
import CheckoutStatus, { CheckoutStep } from './CheckoutStatus';

type Tab = 'cart' | 'checkout' | 'success';

// Generate pickup time slots from 2:15 PM to 10 PM (Mexico City time)
function generatePickupTimeSlots(): string[] {
    const now = new Date();
    // Convert to Mexico City time
    const mxTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));

    const slots: string[] = [];

    // Opening time: 2:15 PM
    const openingTime = new Date(mxTime);
    openingTime.setHours(14, 15, 0, 0); // 2:15 PM

    // Closing time: 10:00 PM
    const closingTime = new Date(mxTime);
    closingTime.setHours(22, 0, 0, 0);

    // Start time: either now + 20 min prep time, or opening time (whichever is later)
    let currentSlot = new Date(mxTime);
    currentSlot.setMinutes(currentSlot.getMinutes() + 20); // Add 20 min prep time

    // If before opening, start at opening time
    if (currentSlot < openingTime) {
        currentSlot = new Date(openingTime);
    }

    // Round up to next 15-minute interval
    const minutes = currentSlot.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    currentSlot.setMinutes(roundedMinutes, 0, 0);

    // Generate slots every 15 minutes until closing
    while (currentSlot <= closingTime) {
        const timeStr = currentSlot.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        slots.push(timeStr);
        currentSlot.setMinutes(currentSlot.getMinutes() + 15);
    }

    return slots.length > 0 ? slots : ['Cerrado por hoy'];
}

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

    // Animation State
    const [loadingStep, setLoadingStep] = useState<CheckoutStep>('idle');

    const runOrderSequence = async (paymentMethod: 'card' | 'cash') => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            // 1. Sending Order (simulated or real latency)
            setLoadingStep('sending');
            await new Promise(r => setTimeout(r, 4000));

            // Auto-fill address logic
            const finalAddress = orderType === 'pickup' ? 'RECOGER EN TIENDA' : formData.address;

            // Save Order
            const { submitOrder } = await import('@/app/actions/submitOrder');
            const result = await submitOrder({ ...formData, address: finalAddress, paymentMethod }, items, cartTotal);

            if (!result.success) throw new Error(result.error);

            if (paymentMethod === 'card') {
                // Create Checkout Session
                const response = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items, orderId: result.orderId }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Error del servidor: ${errorText}`);
                }

                const data = await response.json();
                if (data.clientSecret) {
                    setClientSecret(data.clientSecret);
                    setLoadingStep('idle'); // Stop animation to show modal
                    setIsSubmitting(false); // Enable interaction again (modal handles it)
                } else {
                    throw new Error('No se recibió el secreto de pago');
                }
            } else {
                // Cash Flow Success Sequence
                setLoadingStep('notifying'); // Verify/Notify
                await new Promise(r => setTimeout(r, 4000));

                setLoadingStep('success'); // Celebration
                await new Promise(r => setTimeout(r, 8000)); // Display success for 8 seconds as requested

                clearCart();
                setStep('success');
                setLoadingStep('idle');
                setIsSubmitting(false);
            }

        } catch (err: any) {
            console.error("Payment Error:", err);
            alert(`⚠️ Error: ${err.message || 'Error desconocido'}`);
            setLoadingStep('idle');
            setIsSubmitting(false);
        }
    };

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
                        {/* Loading Overlay */}
                        <AnimatePresence>
                            {loadingStep !== 'idle' && (
                                <CheckoutStatus step={loadingStep} />
                            )}
                        </AnimatePresence>

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

                                            {/* Form Fields with Icons */}
                                            <div className="space-y-4">
                                                <div className="relative">
                                                    <div className="absolute left-4 top-3.5 text-gray-400">
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                    </div>
                                                    <input
                                                        value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                        className="w-full pl-12 p-3 rounded-xl border border-gray-200 focus:border-yoko-primary focus:ring-2 focus:ring-green-100 outline-none transition bg-white"
                                                        placeholder="Tu nombre"
                                                    />
                                                </div>

                                                {orderType === 'delivery' && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="relative"
                                                    >
                                                        <div className="absolute left-4 top-3.5 text-gray-400">
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                                        </div>
                                                        <input
                                                            value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                                                            className="w-full pl-12 p-3 rounded-xl border border-gray-200 focus:border-yoko-primary focus:ring-2 focus:ring-green-100 outline-none transition bg-white"
                                                            placeholder="Dirección de entrega"
                                                        />
                                                    </motion.div>
                                                )}

                                                <div className="relative">
                                                    <div className="absolute left-4 top-3.5 text-gray-400">
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                                    </div>
                                                    <input
                                                        type="tel"
                                                        value={formData.phone}
                                                        onChange={e => {
                                                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                            setFormData({ ...formData, phone: val });
                                                        }}
                                                        className="w-full pl-12 p-3 rounded-xl border border-gray-200 focus:border-yoko-primary focus:ring-2 focus:ring-green-100 outline-none transition bg-white"
                                                        placeholder="Teléfono (10 dígitos)"
                                                        inputMode="numeric"
                                                    />
                                                </div>
                                            </div>

                                            {/* PICKUP TIME SELECTOR (Native iOS/Android Style) */}
                                            {orderType === 'pickup' && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="space-y-2 pt-2"
                                                >

                                                    <div className="relative w-full">
                                                        <select
                                                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                                            onChange={(e) => {
                                                                const time = e.target.value;
                                                                if (!time) return;
                                                                const cleanInstr = formData.instructions.replace(/Recoger a las.*?\.\s*/, '');
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    instructions: `Recoger a las ${time}. ` + cleanInstr
                                                                }));
                                                            }}
                                                        >
                                                            <option value="">Seleccionar hora...</option>
                                                            {generatePickupTimeSlots().map((time) => (
                                                                <option key={time} value={time}>{time}</option>
                                                            ))}
                                                        </select>
                                                        <div className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${formData.instructions.includes('Recoger a las')
                                                            ? 'border-yoko-primary bg-green-50 text-yoko-dark'
                                                            : 'border-gray-200 bg-white text-gray-500'
                                                            }`}>
                                                            <span className="font-bold text-lg">
                                                                {formData.instructions.match(/Recoger a las (.*?)\./)?.[1] || "Elegir Hora..."}
                                                            </span>
                                                            <div className="bg-gray-100 p-2 rounded-full">
                                                                {formData.instructions.includes('Recoger a las') ? (
                                                                    <CheckCircle2 size={20} className="text-yoko-primary" />
                                                                ) : (
                                                                    <span className="text-xl">👇</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}

                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Instrucciones</label>
                                                <textarea
                                                    value={formData.instructions} onChange={e => setFormData({ ...formData, instructions: e.target.value })}
                                                    className="w-full p-3 rounded-xl border border-gray-200 focus:border-yoko-primary focus:ring-2 focus:ring-green-100 outline-none transition"
                                                    placeholder={orderType === 'delivery' ? "¿Sin cebolla? ¿Salsa extra?" : "Alguna petición especial..."}
                                                    rows={2}
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
                            <div className="p-6 bg-white border-t border-gray-100 shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.03)] z-20">
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
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {/* Simplified Footer with Unified Actions or Selector */}
                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <button
                                                onClick={() => runOrderSequence('card')}
                                                disabled={!formData.name || (orderType === 'delivery' && !formData.address) || formData.phone.length < 10 || isSubmitting}
                                                className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-slate-100 hover:border-[#635BFF] hover:bg-slate-50 transition-all group disabled:opacity-50"
                                            >
                                                <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">💳</span>
                                                <span className="text-xs font-bold text-gray-600 group-hover:text-[#635BFF]">Tarjeta</span>
                                            </button>
                                            <button
                                                onClick={() => runOrderSequence('cash')}
                                                disabled={!formData.name || (orderType === 'delivery' && !formData.address) || formData.phone.length < 10 || isSubmitting}
                                                className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-slate-100 hover:border-green-500 hover:bg-green-50 transition-all group disabled:opacity-50"
                                            >
                                                <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">💵</span>
                                                <span className="text-xs font-bold text-gray-600 group-hover:text-green-600">Efectivo</span>
                                            </button>
                                        </div>

                                        <p className="text-[10px] text-center text-gray-400">
                                            Al continuar, aceptas nuestros términos de servicio.
                                        </p>

                                        <button onClick={() => setStep('cart')} className="w-full text-gray-400 font-bold py-2 text-sm hover:text-gray-600">
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

