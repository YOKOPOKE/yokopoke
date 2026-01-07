
import os

file_path = 'c:/Users/Kaleb/Desktop/yoko_poke_house/index.html'

new_checkout_html = """
    <!-- FULL SCREEN CHECKOUT VIEW -->
    <div id="checkout-view" class="fixed inset-0 z-[60] bg-gray-50 hidden flex flex-col">

        <!-- HEADER -->
        <div class="bg-yoko-dark px-4 py-4 flex items-center shadow-md shrink-0">
            <button onclick="closeCheckout()"
                class="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors">
                <i class="fa-solid fa-arrow-left text-xl"></i>
            </button>
            <h2 class="flex-1 text-center text-white font-serif font-bold text-xl mr-10">Confirmar Pedido</h2>
        </div>

        <!-- SCROLLABLE CONTENT -->
        <div class="flex-1 overflow-y-auto overflow-x-hidden pb-32">
            <div class="max-w-2xl mx-auto w-full p-4 space-y-4">

                <!-- ORDER SUMMARY -->
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <p class="text-xs text-gray-400 font-bold uppercase mb-2">Tu Pedido</p>
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-bold text-yoko-dark text-lg" id="summary-main-item">Yoko Bowl</h3>
                            <p class="text-xs text-gray-500 line-clamp-2 mt-1" id="summary-details">Detalles...</p>
                        </div>
                        <span class="font-bold text-yoko-primary text-xl" id="summary-price">$0.00</span>
                    </div>
                </div>

                <!-- DELIVERY TOGGLE -->
                <div class="bg-gray-200 p-1 rounded-xl flex relative">
                    <div id="toggle-bg"
                        class="absolute inset-y-1 left-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-all duration-300">
                    </div>
                    <button
                        class="flex-1 relative z-10 py-3 text-sm font-bold text-yoko-dark flex items-center justify-center gap-2 transition-colors"
                        onclick="setDeliveryMode('pickup')">
                        <i class="fa-solid fa-store"></i> Recoger
                    </button>
                    <button
                        class="flex-1 relative z-10 py-3 text-sm font-bold text-gray-500 flex items-center justify-center gap-2 transition-colors"
                        onclick="setDeliveryMode('delivery')">
                        <i class="fa-solid fa-motorcycle"></i> A Domicilio
                    </button>
                </div>
                <input type="hidden" id="delivery-mode-input" value="pickup">

                <!-- DATA FORM -->
                <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-2 mb-6">
                        <i class="fa-regular fa-user text-lg text-yoko-primary"></i>
                        <h3 class="font-bold text-yoko-dark uppercase text-sm tracking-wider">Tus Datos</h3>
                    </div>

                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase mb-2">Nombre Completo *</label>
                            <input type="text" id="cust-name-full"
                                class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-yoko-primary focus:bg-white outline-none transition-all"
                                placeholder="Ej. Juan Pérez">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase mb-2">Teléfono (WhatsApp) *</label>
                            <input type="tel" id="cust-phone-full"
                                class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-yoko-primary focus:bg-white outline-none transition-all"
                                placeholder="Ej. 963 123 4567">
                        </div>
                    </div>
                </div>

                <!-- ADDRESS SECTION (Conditional) -->
                <div id="address-section" class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hidden">
                    <div class="flex items-center gap-2 mb-6">
                        <i class="fa-solid fa-map-location-dot text-lg text-yoko-primary"></i>
                        <h3 class="font-bold text-yoko-dark uppercase text-sm tracking-wider">Dirección de Entrega</h3>
                    </div>
                    <div class="space-y-4">
                        <textarea id="cust-address-full"
                            class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-yoko-primary focus:bg-white outline-none transition-all h-24 resize-none"
                            placeholder="Calle, Número, Colonia y Referencias..."></textarea>
                    </div>
                </div>

                <!-- PAYMENT SECTION -->
                <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div class="flex items-center gap-2 mb-4">
                        <i class="fa-regular fa-credit-card text-lg text-yoko-primary"></i>
                        <h3 class="font-bold text-yoko-dark uppercase text-sm tracking-wider">Método de Pago</h3>
                    </div>
                    <div class="flex gap-4">
                        <label class="flex-1 cursor-pointer">
                            <input type="radio" name="payment-method-full" value="cash" checked class="peer sr-only">
                            <div class="p-4 rounded-xl border-2 border-gray-100 bg-white peer-checked:border-yoko-primary peer-checked:bg-green-50/50 flex flex-col items-center gap-2 transition-all">
                                <i class="fa-solid fa-money-bill-wave text-2xl text-green-600"></i>
                                <span class="font-bold text-sm text-gray-700">Efectivo</span>
                            </div>
                        </label>
                        <label class="flex-1 cursor-pointer">
                            <input type="radio" name="payment-method-full" value="transfer" class="peer sr-only">
                            <div class="p-4 rounded-xl border-2 border-gray-100 bg-white peer-checked:border-yoko-primary peer-checked:bg-green-50/50 flex flex-col items-center gap-2 transition-all">
                                <i class="fa-solid fa-building-columns text-2xl text-blue-600"></i>
                                <span class="font-bold text-sm text-gray-700">Transferencia</span>
                            </div>
                        </label>
                    </div>
                </div>

            </div>
        </div>

        <!-- BOTTOM BAR -->
        <div class="bg-white p-4 border-t border-gray-100 shrink-0">
            <button onclick="confirmRealOrderFull()"
                class="w-full bg-yoko-primary hover:bg-yoko-dark text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg">
                <i class="fa-brands fa-whatsapp text-2xl"></i>
                <span>Enviar Pedido</span>
            </button>
        </div>
    </div>

    <!-- SUCCESS OVERLAY -->
    <div id="success-overlay"
        class="hidden fixed inset-0 z-[100] bg-gradient-to-br from-yoko-primary to-yoko-secondary flex flex-col items-center justify-center p-6">
        <div class="animate-bounce mb-8">
            <div class="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <i class="fa-solid fa-check text-6xl text-white"></i>
            </div>
        </div>
        <h2 class="text-4xl font-serif font-bold text-white mb-2">¡Pedido Recibido!</h2>
        <p class="text-white/80 text-lg mb-8 max-w-sm text-center">Tu orden está siendo preparada con amor. ❤️</p>

        <div class="bg-white/10 p-6 rounded-2xl backdrop-blur-sm border border-white/20 w-full max-w-sm mb-8">
            <p class="text-sm text-white/60 uppercase tracking-widest font-bold mb-1 text-center">Orden #</p>
            <p class="text-4xl font-mono font-bold text-white text-center" id="success-order-id">0000</p>
        </div>

        <button onclick="location.reload()"
            class="px-8 py-3 bg-white text-yoko-primary font-bold rounded-full hover:bg-gray-100 transition-colors shadow-lg">
            Volver al Inicio
        </button>
    </div>
"""

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # We identified that:
    # Line 996 (1-based) is "<!-- FULL SCREEN CHECKOUT VIEW -->" or somewhere near.
    # We want to keep lines 0 to 995 (0-indexed).
    # And we want to keep lines starting from where <style> begins.
    # Previous greps showed <style> at line 1985 (1-based).
    
    # Let's double check the target lines dynamically to be safe.
    start_cut_index = -1
    end_cut_index = -1

    for i, line in enumerate(lines):
        if 'id="checkout-view"' in line and start_cut_index == -1:
            # We found the start of the checkout view.
            # We also want to capture the comment above it if possible, but let's just stick to the ID line.
            # Actually, let's look for "<!-- FULL SCREEN CHECKOUT VIEW -->" if it exists, roughly before.
            # But relying on ID is safer.
            start_cut_index = i
        
        if '<style>' in line and i > 1000: # Ensure we are at the bottom style tag
            end_cut_index = i
            break
    
    if start_cut_index != -1 and end_cut_index != -1:
        print(f"Cutting from line {start_cut_index} to {end_cut_index}")
        
        # New content = Before Cut + New HTML + From Style onwards
        # We might want to remove the specific comment line above start_cut_index if it exists to avoid duplication
        # but it's minor.
        
        # Adjust start_cut_index to include the comment if it's the immediate previous line
        if "FULL SCREEN CHECKOUT VIEW" in lines[start_cut_index-1]:
            start_cut_index -= 1

        final_content = "".join(lines[:start_cut_index]) + new_checkout_html + "\n" + "".join(lines[end_cut_index:])
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(final_content)
        print("Successfully updated index.html")
    else:
        print(f"Could not find start/end markers. Start: {start_cut_index}, End: {end_cut_index}")

except Exception as e:
    print(f"Error: {e}")
