// Init AOS with Mirror enabled for re-animation on scroll
AOS.init({
    once: false, // Allows repeating
    mirror: true, // Animates when scrolling back up
    offset: 40,   // Trigger sooner (less scrolling needed)
    duration: 600, // Faster animations (snappier)
    throttleDelay: 99, // Improve scroll performance
    disableMutationObserver: true, // Performance boost restored
});

// --- UPS/EXTRAS DATA ---
// --- UPS/EXTRAS DATA (Fallback/Default) ---
let extrasMenu = {
    sides: [
        { name: 'Kushiague de Plátano con Queso', category: 'side', price: 65, description: 'Brocheta empanizada de plátano macho y queso.' },
        { name: 'Kushiague de Queso Manchego', category: 'side', price: 60, description: 'Brocheta empanizada de queso manchego.' },
        { name: 'Edamames Asados', category: 'side', price: 75, description: 'Vainas de soya asadas con sal de grano y limón.' },
        { name: 'Papas Gajo', category: 'side', price: 55, description: 'Papas sazonadas y fritas.' }
    ],
    drinks: [
        { name: 'Water People', category: 'drink', price: 35 },
        { name: 'Refresher del día', category: 'drink', price: 50 },
        { name: 'Café', category: 'drink', price: 35 },
        { name: 'Agua Embotellada', category: 'drink', price: 25 },
        { name: 'Coca Cola', category: 'drink', price: 35 },
        { name: 'Coca Cola Light', category: 'drink', price: 35 },
        { name: 'Soda Japonesa', category: 'drink', price: 35 },
        { name: 'Monster Zero', category: 'drink', price: 48 },
        { name: 'Modelo Especial', category: 'drink', price: 45 },
        { name: 'Modelo Negra', category: 'drink', price: 45 },
        { name: 'Modelo Negra 0%', category: 'drink', price: 45 },
        { name: 'Lucky Buddha Beer', category: 'drink', price: 85 }
    ],
    desserts: [
        { name: 'By GERANIO', category: 'dessert', price: 110, description: 'Postres contemporáneos basados en la temporalidad e innovación.' },
        { name: 'Helado Artesanal', category: 'dessert', price: 95, description: 'Sabores de temporada.' },
        { name: 'Mochis', category: 'dessert', price: 100, description: 'Bocaditos dulces de arroz con textura elástica.' }
    ]
};

let currentOrder = {
    base: null,
    proteins: [],
    mixins: [], // Fresh Toppings
    crunches: [], // Dry Toppings
    sauces: [],
    toppings: [], // Legacy compat if needed, but we use mixins/crunches
    toppings: [], // Legacy compat if needed, but we use mixins/crunches
    extras: [] // Sides, Drinks, etc.
};

let activeExtraCategory = 'sides'; // Default tab

// --- 3D TILT INIT ---
function initTilt() {
    if (typeof VanillaTilt !== 'undefined') {
        const heroImage = document.querySelector("#hero-image-container");
        if (heroImage) {
            VanillaTilt.init(heroImage, {
                max: 10,
                speed: 400,
                glare: true,
                "max-glare": 0.4,
                gyroscope: false
            });
        }
    }
}


// --- MENU DATA ---
import { supabase } from './supabaseClient.js';

// --- MENU DATA (DYNAMIC) ---
let menu = {
    bases: [],
    proteins: [],
    mixins: [],
    sauces: [],
    toppings: [],
    crunches: [], // New category
    drinks: []   // New category
};

// --- PRODUCT CONFIGURATION ---
const PRODUCT_TYPES = {
    BOWL: 'bowl',
    BURGER: 'burger'
};

// Will be populated from Supabase
let SIZE_CONFIG = {};

// Burger-specific menu
// Burger-specific menu will be merged dynamically
let burgerMenu = {
    bases: [],
    proteins: [],
    mixins: [],
    sauces: [],
    toppings: [],
    crunches: []
};

// Current product selection (Bowl pre-selected to match UI)
let currentProduct = {
    type: 'bowl',    // 'bowl' | 'burger' - Bowl pre-selected
    size: null,      // 'small' | 'medium' | 'large' | 'regular'
    basePrice: 170,
    limits: {
        mixins: 4,
        sauces: 2,
        priceMixin: 10,
        priceSauce: 10
    }
};

const LIMITS = {
    mixins: 4,
    sauces: 2,
    priceMixin: 10, // Costo extra por mixin
    priceSauce: 10  // Costo extra por salsa
};




/* End of initial currentOrder */

const BASE_PRICE = 170;

// --- PRODUCT SELECTION FUNCTIONS ---
function selectProductType(type) {
    currentProduct.type = type;

    // Update UI
    const bowlCard = document.getElementById('product-card-bowl');
    const burgerCard = document.getElementById('product-card-burger');

    if (type === 'bowl') {
        bowlCard.classList.add('border-yoko-primary');
        bowlCard.classList.remove('border-transparent');
        burgerCard.classList.add('border-transparent');
        burgerCard.classList.remove('border-yoko-primary');
    } else {
        burgerCard.classList.add('border-yoko-primary');
        burgerCard.classList.remove('border-transparent');
        bowlCard.classList.add('border-transparent');
        bowlCard.classList.remove('border-yoko-primary');
    }

    playSound('pop');
}

function selectSize(event, size) {
    event.stopPropagation(); // Prevent card click

    currentProduct.size = size;
    const config = SIZE_CONFIG[size];
    currentProduct.basePrice = config.basePrice;
    currentProduct.limits = {
        mixins: config.mixins,
        sauces: config.sauces,
        priceMixin: config.priceMixin,
        priceSauce: config.priceSauce
    };

    // Clear all size buttons
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.classList.remove('border-yoko-primary', 'bg-green-50');
        btn.classList.add('border-transparent', 'bg-gray-100');
    });

    // Highlight selected
    event.currentTarget.classList.add('border-yoko-primary', 'bg-green-50');
    event.currentTarget.classList.remove('border-transparent', 'bg-gray-100');

    // Enable start button
    const startBtn = document.getElementById('start-builder-btn');
    startBtn.disabled = false;
    startBtn.classList.remove('bg-gray-400', 'cursor-not-allowed', 'opacity-50');
    startBtn.classList.add('bg-yoko-primary', 'hover:bg-yoko-dark', 'cursor-pointer');

    playSound('pop');
}

function startBuilder() {
    if (!currentProduct.type || !currentProduct.size) {
        showToast('Selecciona un producto y tamaÃ±o', 'âš ï¸');
        return;
    }

    // Hide selector, show builder
    document.getElementById('product-selector').classList.add('hidden');
    document.getElementById('arma-tu-bowl').classList.remove('hidden');

    // Update builder title
    const config = SIZE_CONFIG[currentProduct.size];
    const productName = currentProduct.type === 'bowl' ? 'Poke Bowl' : 'Sushi Burger';
    document.getElementById('builder-title').textContent = `Arma tu ${productName} ${config.name}`;

    // Load menu based on product type
    loadProductMenu();

    // Initialize wizard
    currentStep = 0;
    updateWizardUI();

    // Scroll to builder
    document.getElementById('arma-tu-bowl').scrollIntoView({ behavior: 'smooth' });

    showToast(`${productName} ${config.name} - $${config.basePrice}`, 'âœ…');
}

function loadProductMenu() {
    // This function will dynamically load ingredients for burger if needed
    // For now, we'll use the existing menu for bowls and burgerMenu for burgers
    const activeMenu = currentProduct.type === 'burger' ? burgerMenu : menu;

    // Re-generate wizard steps with the appropriate menu
    // This is handled automatically since we reference the global menu object
}

// --- PERSISTENCE ---
function saveOrderToStorage() {
    localStorage.setItem('yoko_order', JSON.stringify(currentOrder));
    localStorage.setItem('yoko_step', currentStep);
}

function loadOrderFromStorage() {
    const savedOrder = localStorage.getItem('yoko_order');
    const savedStep = localStorage.getItem('yoko_step');

    if (savedOrder) {
        try {
            currentOrder = JSON.parse(savedOrder);
            // Re-render UI based on loaded data
            updateUIState();
            renderSummary();

            // Restore checkbox states/* No change needed here, just verifying logic structure */render)
            // Ideally we re-check boxes after rendering builder
        } catch (e) {
            console.error('Error loading order', e);
        }
    }

    if (savedStep) {
        currentStep = parseInt(savedStep, 10);
        // Ensure bounds
        if (isNaN(currentStep)) currentStep = 0;
    }
}

function initBuilder() {
    loadOrderFromStorage(); // Load data before rendering

    // Select the correct menu based on product type
    const activeMenu = currentProduct.type === 'burger' ? burgerMenu : menu;

    // Render Bases
    const basesContainer = document.getElementById('bases-options');
    if (basesContainer) {
        basesContainer.innerHTML = activeMenu.bases.map(b => `
        <label class="cursor-pointer group h-full block">
            <input type="radio" name="base" class="sr-only ingredient-radio"
                ${currentOrder.base === b.name ? 'checked' : ''}
            onchange="updateOrder('base', '${b.name}', 0, this); flyToCart('${b.icon}', this.parentElement)">
            <div class="bg-white/70 backdrop-blur-md border border-white/50 rounded-xl p-2 lg:p-4 text-center h-full flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:bg-white/90 hover:scale-105 shadow-sm">
                <span class="text-3xl lg:text-4xl mb-1 lg:mb-2 transition-transform group-hover:scale-110 duration-300 drop-shadow-sm">${b.icon}</span>
                <span class="text-xs lg:text-sm font-bold text-gray-800 leading-tight">${b.name}</span>
            </div>
        </label>
`).join('');
    }

    // Render Proteins
    const proteinsContainer = document.getElementById('proteins-options');
    if (proteinsContainer) {
        proteinsContainer.innerHTML = activeMenu.proteins.map(p => {
            const isChecked = currentOrder.proteins.some(i => i.name === p.name);
            return `
        <label class="cursor-pointer group h-full block">
            <input type="checkbox" name="protein" class="sr-only ingredient-checkbox"
            ${isChecked ? 'checked' : ''}
            onchange="if(this.checked) { updateOrder('proteins', '${p.name}', ${p.price}, this); flyToCart('${p.icon}', this.parentElement); } else { flyBackToCard('${p.name}', '${p.icon}', this.parentElement); setTimeout(() => updateOrder('proteins', '${p.name}', ${p.price}, this), 200); }">
            <div class="bg-white/70 backdrop-blur-md border border-white/50 rounded-xl p-2 lg:p-4 text-center h-full flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:bg-white/90 hover:scale-105 shadow-sm">
                <span class="text-3xl lg:text-4xl mb-1 lg:mb-2 transition-transform group-hover:scale-110 duration-300 drop-shadow-sm">${p.icon}</span>
                <span class="text-xs lg:text-sm font-bold text-gray-800 leading-tight">${p.name}</span>
                ${p.price > 0 ? `<span class="text-[10px] lg:text-xs text-yoko-accent font-bold mt-0.5 lg:mt-1">+ $${p.price}</span>` : ''}
                <i class="fa-solid fa-check-circle text-yoko-accent absolute top-1 right-1 lg:top-2 lg:right-2 opacity-0 check-icon transition text-xs lg:text-base"></i>
            </div>
        </label>
`}).join('');
    }

    // Generic Render for simple lists
    const renderSimple = (id, items, type) => {
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = items?.map(item => {
                const isChecked = currentOrder[type]?.includes(item.name);
                return `
        <label class="cursor-pointer group h-full block">
            <input type="checkbox" name="${type}" value="${item.name}" class="sr-only ingredient-checkbox ${type}-checkbox"
            ${isChecked ? 'checked' : ''}
            onchange="if(this.checked) { updateOrder('${type}', '${item.name}', 0, this); flyToCart('${item.icon}', this.parentElement); } else { flyBackToCard('${item.name}', '${item.icon}', this.parentElement); setTimeout(() => updateOrder('${type}', '${item.name}', 0, this), 200); }">
            <div class="bg-white/70 backdrop-blur-md border border-white/50 rounded-xl p-2 lg:p-4 flex flex-col items-center justify-center gap-0.5 lg:gap-1 relative overflow-hidden h-full transition-all duration-300 hover:shadow-xl hover:bg-white/90 hover:scale-105 shadow-sm">
                <span class="text-2xl lg:text-3xl transition-transform group-hover:scale-110 duration-300 drop-shadow-sm">${item.icon}</span>
                <span class="text-xs lg:text-sm font-bold text-gray-800 leading-tight text-center">${item.name}</span>
                <i class="fa-solid fa-check-circle text-yoko-accent absolute top-1 right-1 opacity-0 check-icon text-[10px] lg:text-sm transition"></i>
            </div>
        </label>
`}).join('') || '<p class="text-gray-400 text-sm p-4">Cargando opciones...</p>';
        }
    };


    renderSimple('mixins-options', activeMenu.mixins || [], 'mixins'); // Usually toppings fresh
    renderSimple('sauces-options', activeMenu.sauces, 'sauces');
    renderSimple('toppings-options', activeMenu.crunches || [], 'crunches'); // Using Crunch from DB for toppings step

    // Refresh UI to match loaded state
    updateWizardUI();

    window.scrollTo(0, 0);
}

// --- DATA FETCHING ---
async function fetchMenuData() {
    // 1. Fetch Sizes
    const { data: sizes, error: sizesError } = await supabase.from('sizes').select('*');
    if (sizesError) console.error(sizesError);

    // Map DB sizes to config
    // We will dynamically build SIZE_CONFIG. 
    // Manual mapping for now specifically for the UI keys 'small', 'medium', 'large'
    // Assuming DB has names "Mediano", "Grande", etc.
    if (sizes) {
        sizes.forEach(s => {
            // Normalized keys to match HTML hardcoded clicks
            let key = 'medium';
            const nameLower = s.name.toLowerCase();
            if (nameLower.includes('peque')) key = 'small';
            if (nameLower.includes('mediano')) key = 'medium';
            if (nameLower.includes('grande')) key = 'large';
            // If we add 'Regular' for burger later
            if (nameLower.includes('regular')) key = 'regular';

            // Mapping DB columns to Config
            SIZE_CONFIG[key] = {
                name: s.name,
                basePrice: parseFloat(s.base_price),
                maxProteins: s.included_proteins || 1,
                mixins: s.included_toppings || 3,
                crunches: s.included_crunches || 2,
                sauces: s.included_sauces || 1,
                priceProtein: parseFloat(s.price_extra_protein) || 40,
                priceMixin: parseFloat(s.price_extra_topping) || 25,
                priceCrunch: parseFloat(s.price_extra_crunch) || 15,
                priceSauce: parseFloat(s.price_extra_sauce) || 15
            };
        });

        // Fix: Ensure 'regular' exists for Burger if not fetched
        if (!SIZE_CONFIG['regular']) {
            SIZE_CONFIG['regular'] = { name: 'Regular', basePrice: 150, maxProteins: 1, mixins: 3, crunches: 2, sauces: 2, priceMixin: 10, priceSauce: 10, priceCrunch: 15, priceProtein: 40 };
        }
        // Fix: Ensure 'small' exists if not fetched (Hide it in UI but allow config to prevent crash)
        if (!SIZE_CONFIG['small']) {
            // We won't show it, but prevent crash if clicked
            SIZE_CONFIG['small'] = { name: 'PequeÃ±o', basePrice: 120, maxProteins: 1, mixins: 3, crunches: 2, sauces: 1, priceMixin: 10, priceSauce: 10, priceCrunch: 15, priceProtein: 40 };
        }

    } else {
        // Safe defaults
        SIZE_CONFIG = {
            small: { name: 'PequeÃ±o', basePrice: 120, maxProteins: 1, mixins: 3, crunches: 2, sauces: 1 },
            medium: { name: 'Mediano', basePrice: 145, maxProteins: 1, mixins: 3, crunches: 2, sauces: 1 },
            large: { name: 'Grande', basePrice: 165, maxProteins: 2, mixins: 4, crunches: 2, sauces: 2 },
            regular: { name: 'Regular', basePrice: 150, maxProteins: 1, mixins: 3, crunches: 2, sauces: 2 }
        };
    }

    // UPDATE UI FROM DATA
    updateSizeButtons();


    // 2. Fetch Ingredients (Builders)
    const { data: ingredients, error: ingredError } = await supabase
        .from('ingredients')
        .select('*')
        .eq('is_available', true);

    if (ingredError) console.error(ingredError);

    if (ingredients) {
        menu = { bases: [], proteins: [], mixins: [], sauces: [], toppings: [], crunches: [], drinks: [] };
        burgerMenu = { bases: [], proteins: [], mixins: [], sauces: [], toppings: [], crunches: [] }; // Keep burgerMenu for now, even if not populated by new logic

        ingredients.forEach(i => {
            const item = {
                id: i.id.toString(),
                name: i.name,
                icon: i.icon || 'ðŸ¥¢',
                price: parseFloat(i.premium_price) || 0
            };

            // Map DB types to JS arrays
            let type = i.type;
            if (type === 'topping') menu.mixins.push(item); // Fresh Toppings -> Mixins in JS ref
            else if (type === 'crunch') menu.crunches.push(item);
            else if (type === 'sauce') menu.sauces.push(item);
            else if (type === 'protein') menu.proteins.push(item);
            else if (type === 'base') menu.bases.push(item);
        });
    }

    // 3. Fetch Sides/Drinks (Upsell)
    const { data: menuItems, error: menuItemsError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_available', true);

    if (menuItemsError) console.error(menuItemsError);

    if (menuItems) {
        extrasMenu = { sides: [], drinks: [], desserts: [] };
        menuItems.forEach(item => {
            const extra = { ...item, price: parseFloat(item.price) };
            if (item.category === 'side') extrasMenu.sides.push(extra);
            if (item.category === 'drink') extrasMenu.drinks.push(extra);
            if (item.category === 'dessert') extrasMenu.desserts.push(extra);
        });

        // Render Upsell Section

        renderExtrasStep(); // Populate Wizard Step 5
    }
}





// --- RENDER CHECKOUT UPSELL (Last Minute Add) ---
function renderCheckoutUpsell() {
    const container = document.getElementById('checkout-upsell-container');
    if (!container) return;

    // Flatten extras for quick add grid
    const suggestions = [
        ...extrasMenu.drinks.slice(0, 4), // Top 4 drinks
        ...extrasMenu.sides.slice(0, 2),  // Top 2 sides
        ...extrasMenu.desserts.slice(0, 1) // Top 1 dessert
    ];

    // Sort slightly randomly or fixed? Fixed is okay.

    let html = `
    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h3 class="font-bold text-yoko-dark mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
            <i class="fa-solid fa-plus-circle text-yoko-accent"></i> ¿Algo mas?
        </h3>
        <div class="grid grid-cols-2 gap-3" id="checkout-upsell-grid">
            ${suggestions.map(item => `
                <div class="border border-gray-100 rounded-xl p-3 flex flex-col justify-between hover:border-yoko-accent transition-colors group cursor-pointer"
                     onclick="toggleExtra('${item.name}', ${item.price}, '${item.category}')">
                    
                    <div class="flex justify-between items-start">
                        <span class="font-bold text-xs text-gray-700 leading-tight group-hover:text-yoko-accent">${item.name}</span>
                        <span class="text-xs font-bold text-yoko-primary">$${item.price}</span>
                    </div>
                    
                    <button class="mt-3 w-full py-1 rounded-lg text-[10px] font-bold transition-all
                                   ${isExtraSelected(item.name) ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-yoko-light group-hover:text-yoko-dark'}">
                        ${isExtraSelected(item.name) ? 'Quitar' : 'Agregar +'}
                    </button>
                </div>
            `).join('')}
        </div>
        
        <!-- Toggle Full Menu -->
        <button onclick="document.getElementById('full-upsell-modal').classList.remove('hidden')" 
                class="w-full mt-4 text-xs font-bold text-yoko-accent hover:underline text-center">
            Ver menÃº completo de extras
        </button>
    </div>
    `;

    container.innerHTML = html;
}

// Check if extra is already in order
function isExtraSelected(name) {
    return currentOrder.extras.some(e => e.name === name);
}

// Toggle Extra
window.toggleExtra = function (name, price, category) {
    const index = currentOrder.extras.findIndex(e => e.name === name);
    const btn = document.getElementById(`btn-extra-${name.replace(/\s+/g, '')}`);

    if (index > -1) {
        // Remove
        currentOrder.extras.splice(index, 1);
        showToast('Eliminado', 'ðŸ—‘ï¸');
    } else {
        // Add
        currentOrder.extras.push({ name, price, category });
        showToast(`Agregado: ${name}`, 'âœ¨');
        playSound('pop');
    }

    saveOrderToStorage();
    renderExtrasStep(); // Refresh UI to show checks/borders
    renderSummary();


    // Refresh Checkout if open
    const checkoutView = document.getElementById('checkout-view');
    if (checkoutView && !checkoutView.classList.contains('hidden')) {
        renderCheckoutSummary();
    }

    // Refresh Main Menu Extras (to show selected state)
    // Efficiency: Only needed if product selector is visible, but fast enough to just call.
    if (!document.getElementById('product-selector').classList.contains('hidden')) {
        renderMainMenuExtras();
    }
};

// Override Init to fetch first
window.addEventListener('DOMContentLoaded', async () => {
    await fetchMenuData(); // Wait for data
    initBuilder();
    /* ... rest of init ... */
});

// --- FLY TO CART ANIMATION ---
// --- FLY TO CART ANIMATION (GPU ACCELERATED) ---
function flyToCart(textOrIcon, startElement) {
    // Disabled for performance optimization - causes lag on interactions
    return;

    if (!startElement) return;

    // Create flying element
    const flyer = document.createElement('div');
    flyer.innerHTML = textOrIcon;
    flyer.className = 'fixed z-[9999] pointer-events-none text-4xl lg:text-5xl drop-shadow-2xl';

    // STARTING POSITION
    const rect = startElement.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    // Force hardware acceleration layer immediately
    flyer.style.left = '0px';
    flyer.style.top = '0px';
    // Combine positioning translate with centering translate
    flyer.style.transform = `translate3d(${startX}px, ${startY}px, 0) translate(-50%, -50%) scale(1)`;
    // Transition only transform and opacity (cheap properties)
    flyer.style.transition = 'transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 1.2s ease';
    flyer.style.willChange = 'transform, opacity'; // Hint to browser

    document.body.appendChild(flyer);

    // TARGET POSITION
    let targetElement = document.getElementById('total-price');
    if (window.innerWidth < 1024) {
        targetElement = document.getElementById('mobile-total') || targetElement;
    }

    if (targetElement) {
        const targetRect = targetElement.getBoundingClientRect();
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;

        // Animate
        requestAnimationFrame(() => {
            // Use translate3d for GPU path
            flyer.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%) scale(0.3)`;
            flyer.style.opacity = '0';
        });
    }

    // Cleanup
    setTimeout(() => {
        flyer.remove();
    }, 1200);
}

// --- FLY BACK TO CARD ANIMATION (GPU ACCELERATED) ---
function flyBackToCard(itemName, icon, cardElement) {
    if (!cardElement) return;

    // 1. Find start position
    let summaryTag = document.querySelector(`#live-summary [data-name="${itemName}"]`);
    // Note: If the tag was just removed from DOM by React-like logic, this might fail to find it.
    // However, since we call this BEFORE updateOrder usually (or concurrently), it might still be there.
    // In our inline calls: "flyBack...; setTimeout(updateOrder...)" -> So tag IS there.

    if (!summaryTag && window.innerWidth < 1024) {
        summaryTag = document.querySelector(`#mobile-live-summary [data-name="${itemName}"]`);
    }

    let startX, startY;

    if (summaryTag) {
        const rect = summaryTag.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
    } else {
        // Fallback
        const panel = document.getElementById('desktop-summary-panel') || document.getElementById('mobile-sticky');
        if (panel) {
            const rect = panel.getBoundingClientRect();
            startX = rect.left + 50;
            startY = rect.top + 100;
        } else {
            startX = window.innerWidth;
            startY = window.innerHeight / 2;
        }
    }

    // Create Flyer
    const flyer = document.createElement('div');
    flyer.innerHTML = icon;
    flyer.className = 'fixed z-[9999] pointer-events-none text-2xl drop-shadow-lg';

    // Initial State
    flyer.style.left = '0px';
    flyer.style.top = '0px';
    flyer.style.transform = `translate3d(${startX}px, ${startY}px, 0) translate(-50%, -50%) scale(0.5)`;

    flyer.style.transition = 'transform 1.0s cubic-bezier(0.4, 0, 0.2, 1), opacity 1.0s ease';
    flyer.style.willChange = 'transform, opacity';
    flyer.style.opacity = '1';

    document.body.appendChild(flyer);

    // Target Position
    const targetRect = cardElement.getBoundingClientRect();
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;

    requestAnimationFrame(() => {
        flyer.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%) scale(1.5)`;
        flyer.style.opacity = '0';
    });

    setTimeout(() => {
        flyer.remove();
    }, 1000);
}

function updateOrder(type, value, price = 0, event) { // Added event param if possible, or use global logic
    // Helper to find clicked element if event not passed directly (onchange limitations)
    // We will assume 'this' context isn't easily passed in inline HTML, 
    // but we can try to find the label that correlates or just pass the event in new HTML generation.
    // For now, let's keep it simple or update HTML generation to pass 'this'.
    // LIMITATION: inline onclick="updateOrder(...)" doesn't pass element easily without `this`.
    // Strategy: We will update HTML generation to pass `this` in next step.

    if (type === 'base') {
        currentOrder.base = value;
        playSound('pop');
    } else {
        const arr = currentOrder[type];
        const index = arr.findIndex(i => typeof i === 'object' ? i.name === value : i === value);

        if (index > -1) {
            // Removing item
            arr.splice(index, 1);
        } else {
            // Adding item 
            if (type === 'proteins') {
                arr.push({ name: value, price: price });
                // Check limit (assuming 1 protein included, or check specific logic)
                // If price is applied (price > 0), warn user.
                if (price > 0) {
                    showToast(`ProteÃ­na extra: +$${price}`, 'ðŸ’°');
                } else {
                    showToast(`Agregada: ${value} `, 'ðŸŸ');
                }
                playSound('pop');
            } else {
                arr.push(value);
                const iconMap = { mixins: 'ðŸ¥—', sauces: 'ðŸ¯', toppings: 'ðŸ¥œ' };
                // Check Limits
                let limit = 99;
                let cost = 0;

                // Get config for current size logic
                const config = SIZE_CONFIG[currentProduct.size];

                if (type === 'mixins') { limit = config.mixins; cost = config.priceMixin; }
                if (type === 'crunches') { limit = config.crunches; cost = config.priceCrunch; }
                if (type === 'sauces') { limit = config.sauces; cost = config.priceSauce; }

                if (arr.length > limit && cost > 0) {
                    showToast(`Costo extra: +$${cost}`, 'ðŸ’°');
                } else {
                    showToast(`Agregado: ${value} `, iconMap[type] || 'âœ…');
                }
                playSound('pop');
            }
        }
    }

    // Optimize: Use requestAnimationFrame to batch DOM updates
    if (updateOrder.rafId) {
        cancelAnimationFrame(updateOrder.rafId);
    }

    updateOrder.rafId = requestAnimationFrame(() => {
        saveOrderToStorage(); // PERSISTENCE SAVE
        updateUIState();

        if (typeof updateWizardUI === 'function') {
            validateStep(); // Check validity
            updateWizardUI(); // Refresh visual state (buttons)
            renderSummary(); // Re-render summary
        } else {
            renderSummary();
        }

        updateOrder.rafId = null;
    });
}

// --- WIZARD LOGIC ---
let currentStep = 0;
const totalSteps = 6;


// --- RENDER EXTRAS STEP (Wizard Step 5) ---
window.setExtraCategory = function (category) {
    activeExtraCategory = category;
    renderExtrasStep();
};

function renderExtrasStep() {
    const container = document.getElementById('extras-step-container');
    if (!container) return;

    // Define Sections
    const sections = [
        { id: 'sides', title: 'Entradas', icon: '<i class="fa-solid fa-bowl-food"></i>' },
        { id: 'drinks', title: 'Bebidas', icon: '<i class="fa-solid fa-glass-water"></i>' },
        { id: 'desserts', title: 'Postres', icon: '<i class="fa-solid fa-ice-cream"></i>' }
    ];

    // Get items for current selection
    let currentItems = [];
    if (activeExtraCategory === 'sides') currentItems = extrasMenu.sides;
    if (activeExtraCategory === 'drinks') currentItems = extrasMenu.drinks;
    if (activeExtraCategory === 'desserts') currentItems = extrasMenu.desserts;

    let html = `
        <!-- Category Tabs -->
        <div class="flex gap-3 overflow-x-auto pb-4 mb-2 no-scrollbar" style="-webkit-overflow-scrolling: touch;">
            ${sections.map(sec => `
                <button onclick="setExtraCategory('${sec.id}')"
                    class="px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 shadow-sm
                    ${activeExtraCategory === sec.id
            ? 'bg-yoko-accent text-white shadow-yoko-accent/30 shadow-lg scale-105'
            : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-yoko-dark border border-gray-100'}">
                    ${sec.title}
                </button>
            `).join('')}
        </div>

        <!-- Animation Wrapper -->
        <div>
            <h3 class="text-lg font-bold text-yoko-dark mb-4 flex items-center gap-2 animate-fade-in-up">
                <span class="bg-indigo-50 text-indigo-500 w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-sm">
                    ${sections.find(s => s.id === activeExtraCategory).icon}
                </span>
                ${sections.find(s => s.id === activeExtraCategory).title}
            </h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                ${currentItems.length ? currentItems.map((item, index) => `
                    <div class="group relative overflow-hidden rounded-xl transition-all duration-300 cursor-pointer animate-fade-in-up flex items-center p-3 gap-3
                                ${isExtraSelected(item.name)
                    ? 'bg-white shadow-md ring-2 ring-yoko-accent transform scale-[1.01]'
                    : 'bg-white/70 backdrop-blur-md border border-white/60 hover:bg-white hover:shadow-lg hover:scale-[1.02]'}"
                            style="animation-delay: ${index * 0.03}s; animation-fill-mode: both;"
                            onclick="toggleExtra('${item.name}', ${item.price}, '${item.category}')">
                        
                        <!-- Icon (Left) -->
                        <div class="shrink-0 w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                           ${item.icon || sections.find(s => s.id === activeExtraCategory).icon}
                        </div>

                        <!-- Content (Middle) -->
                        <div class="flex-grow min-w-0">
                            <div class="flex justify-between items-center mb-0.5">
                                <h4 class="font-bold text-sm text-yoko-dark leading-tight line-clamp-1 group-hover:text-yoko-primary transition-colors">${item.name}</h4>
                                <!-- Checkmark (Visible when selected) -->
                                <i class="fa-solid fa-check-circle text-yoko-accent text-lg transition-all duration-300 ${isExtraSelected(item.name) ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}"></i>
                            </div>
                            <div class="flex justify-between items-baseline">
                                <p class="text-[10px] text-gray-400 line-clamp-1 truncate pr-2">${item.description || 'Complemento'}</p>
                                <span class="text-xs font-bold text-yoko-accent shrink-0 bg-yoko-accent/5 px-2 py-0.5 rounded-md">$${item.price}</span>
                            </div>
                        </div>

                        <!-- Subtle Background Flash -->
                        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none"></div>
                    </div>
                `).join('') : `
                    <div class="col-span-full py-8 text-center text-gray-400 italic">
                        No hay opciones disponibles en esta categorÃ­a.
                    </div>
                `}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function updateWizardUI() {
    // Hide all steps first
    for (let i = 0; i < totalSteps; i++) {
        const el = document.getElementById('step-' + i);
        if (el) {
            el.classList.add('hidden', 'opacity-0', 'translate-x-10');
            el.classList.remove('block', 'opacity-100', 'translate-x-0');
        }

        // Update labels
        const label = document.getElementById('step-label-' + i);
        if (label) {
            if (i === currentStep) {
                label.classList.add('text-yoko-accent');
                label.classList.remove('text-gray-400');
            } else if (i < currentStep) {
                label.classList.add('text-green-600');
                label.classList.remove('text-yoko-accent', 'text-gray-400');
            } else {
                label.classList.add('text-gray-400');
                label.classList.remove('text-yoko-accent', 'text-green-600');
            }
        }
    }

    // Show current step
    const currentEl = document.getElementById('step-' + currentStep);
    if (currentEl) {
        currentEl.classList.remove('hidden');
        setTimeout(() => {
            currentEl.classList.remove('opacity-0', 'translate-x-10');
            currentEl.classList.add('opacity-100', 'translate-x-0');
        }, 50);
    }

    // Button States
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    if (prevBtn) {
        prevBtn.disabled = (currentStep === 0);
        if (currentStep === 0) {
            prevBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            prevBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    if (nextBtn) {
        // Reset base classes
        nextBtn.className = 'bg-yoko-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-yoko-dark transition shadow-lg flex items-center gap-2';

        if (currentStep === totalSteps - 1) {
            // STEP 5: FINAL (EXTRAS)
            if (window.innerWidth < 1024) {
                nextBtn.innerHTML = 'Ver Resumen <i class="fa-solid fa-receipt ml-2"></i>';
            } else {
                nextBtn.innerHTML = 'Finalizar Pedido <i class="fa-solid fa-check ml-2"></i>';
            }
            nextBtn.onclick = () => openCheckout();

            nextBtn.classList.remove('bg-yoko-primary');
            nextBtn.classList.add('bg-yoko-accent', 'pop-in');

        } else if (currentStep === 4) {
            // STEP 4: TOPPINGS
            nextBtn.innerHTML = 'Continuar a Extras <i class="fa-solid fa-utensils ml-2"></i>';
            nextBtn.onclick = () => changeStep(1);

        } else {
            // STEPS 0-3
            nextBtn.innerHTML = 'Siguiente <i class="fa-solid fa-arrow-right ml-2"></i>';
            nextBtn.onclick = () => changeStep(1);
        }

        // Validation Visuals
        if (typeof validateStep === 'function' && !validateStep()) {
            nextBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-400');
            nextBtn.classList.remove('bg-yoko-primary', 'hover:bg-yoko-dark', 'bg-yoko-accent');
        } else {
            nextBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-400');
            if (currentStep === totalSteps - 1) {
                nextBtn.classList.add('bg-yoko-accent');
            } else {
                nextBtn.classList.add('bg-yoko-primary');
            }
        }
    }

    if (typeof updateProgressBar === 'function') updateProgressBar();
    if (typeof validateStep === 'function') validateStep();
}

function changeStep(direction) {
    if (direction === 1 && !validateStep(true)) return; // Block if invalid

    currentStep += direction;
    if (currentStep < 0) currentStep = 0;
    if (currentStep >= totalSteps) currentStep = totalSteps - 1;

    saveOrderToStorage(); // Save new step position
    updateWizardUI();

    // Auto scroll to top of wizard on mobile
    const wizardTop = document.getElementById('navbar').offsetHeight;
}

function validateStep(shake = false) {
    let isValid = true;
    let msg = '';

    if (currentStep === 0 && !currentOrder.base) {
        isValid = false;
        msg = 'Selecciona una base para continuar';
    } else if (currentStep === 1 && currentOrder.proteins.length === 0) {
        isValid = false;
        msg = 'Selecciona al menos una proteÃ­na';
        // } else if (currentStep === 4 && currentOrder.toppings.length === 0) {
        //     // Toppings are optional now
        //     // isValid = true;
        // }

    }

    const nextBtn = document.getElementById('next-btn');
    if (!isValid) {
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-400');
            nextBtn.classList.remove('bg-yoko-primary', 'hover:bg-yoko-dark');
        }
        if (shake && nextBtn) {
            nextBtn.classList.add('animate-pulse'); // Simple shake feedback
            setTimeout(() => nextBtn.classList.remove('animate-pulse'), 500);
            showToast(msg, 'âš ï¸');
        }
    } else {
        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-400');
            nextBtn.classList.add('bg-yoko-primary', 'hover:bg-yoko-dark');
        }
    }
    return isValid;
}

// Legacy scrollToSummaryMove removed (Duplicate)

function updateProgressBar() {
    // Progress based on current STEP now (Max 100%)
    let progress = Math.min(100, ((currentStep + 1) / totalSteps) * 100);
    const bar = document.getElementById('builder-progress');
    if (bar) bar.style.width = `${progress}%`;
}

function updateUIState() {
    // Update Counts
    const mixinsCount = document.getElementById('mixins-count');
    if (mixinsCount) mixinsCount.innerText = `${currentOrder.mixins.length} `;

    const saucesCount = document.getElementById('sauces-count');
    if (saucesCount) saucesCount.innerText = `${currentOrder.sauces.length} `;

    // NOTE: Removed logic that disabled checkboxes
}

function renderSummary() {
    // Use product-specific base price
    let total = currentProduct.basePrice || BASE_PRICE;
    let missing = [];

    // Helper to find icon
    const getIcon = (type, name) => {
        const item = menu[type].find(i => i.name === name);
        return item ? item.icon : 'â€¢';
    };

    let html = '';

    // --- BASE ---
    if (currentOrder.base) {
        const icon = getIcon('bases', currentOrder.base);
        html += `
            <div class="flex items-center justify-between py-1 border-b border-white/10">
                <div class="flex items-center gap-2">
                    <span class="text-lg">${icon}</span>
                    <div>
                        <span class="text-[10px] text-yoko-accent font-bold uppercase tracking-wider block leading-none mb-0.5">Base</span>
                        <div class="font-bold leading-none text-xs text-white/90">${currentOrder.base}</div>
                    </div>
                </div>
            </div>`;
    } else {
        missing.push('Base');
        html += `
            <div class="flex items-center justify-between py-1 border-b border-white/10 opacity-50 border-dashed">
                <div class="flex items-center gap-2">
                    <span class="text-lg grayscale">ðŸš</span>
                    <div>
                        <span class="text-[10px] font-bold uppercase tracking-wider block leading-none mb-0.5">Base</span>
                        <div class="text-[10px] italic leading-none">Sin seleccionar</div>
                    </div>
                </div>
            </div>`;
    }

    // --- PROTEINS ---
    if (currentOrder.proteins.length > 0) {
        let count = currentOrder.proteins.length;

        let proteinRows = '';
        currentOrder.proteins.forEach((p, idx) => {
            let cost = p.price;
            if (idx > 0) cost += 45;
            total += cost;
            const icon = getIcon('proteins', p.name);
            const priceTag = cost > 0 ? `<span class="text-xs text-yoko-accent font-bold ml-auto">+$${cost}</span>` : '';

            proteinRows += `
                <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition mb-1">
                    <div class="w-8 h-8 rounded-full bg-blue-500/20 text-blue-200 flex items-center justify-center text-sm shrink-0">
                        ${icon}
                    </div>
                    <span class="font-medium text-sm text-white/90">${p.name}</span>
                    ${priceTag}
                </div>`;
        });

        html += `
            <div class="py-2 border-b border-white/10">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">ProteÃ­nas</span>
                    <span class="text-[10px] bg-blue-500 text-white px-1.5 rounded-full shadow-sm">${count}</span>
                </div>
                <div class="space-y-0.5">
                    ${proteinRows}
                </div>
            </div>`;
    } else {
        missing.push('ProteÃ­na');
    }

    // --- MIXINS / CRUNCHES / SAUCES / TOPPINGS GENERATOR ---
    const renderSection = (title, type, limit, pricePerExtra, masterIcon, colorClass) => {
        let items = currentOrder[type] || [];
        if (items.length > 0) {
            const count = items.length;
            const extra = Math.max(0, count - limit);
            const extraCost = extra * pricePerExtra;
            total += extraCost;

            let rows = '';
            items.forEach(name => {
                // If simple string
                const icon = getIcon(type == 'crunches' ? 'crunches' : type, name);
                rows += `
                <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition mb-1">
                    <div class="w-8 h-8 rounded-full ${colorClass} flex items-center justify-center text-sm shrink-0">
                        ${icon}
                    </div>
                    <span class="font-medium text-sm text-white/90">${name}</span>
                </div>`;
            });

            html += `
                <div class="py-2 border-b border-white/10">
                    <div class="flex justify-between items-center mb-2">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">${title}</span>
                            <span class="text-[10px] bg-white/20 text-white px-1.5 rounded-full shadow-sm">${count}</span>
                        </div>
                        ${extraCost > 0 ? `<span class="text-xs text-yoko-accent font-bold px-2 py-0.5 bg-black/20 rounded">Total Extras: +$${extraCost}</span>` : ''}
                    </div>
                    <div class="space-y-0.5">
                        ${rows}
                    </div>
                </div>`;
        }
    };

    // Get limits from current config
    const config = SIZE_CONFIG[currentProduct.size] || {};

    renderSection('Mixins (Vegetales)', 'mixins', config.mixins || 99, config.priceMixin || 0, 'ðŸ¥—', 'bg-green-500/20 text-green-200');
    renderSection('Crunchs', 'crunches', config.crunches || 99, config.priceCrunch || 0, 'ðŸ¥œ', 'bg-amber-600/20 text-amber-200');
    renderSection('Salsas', 'sauces', config.sauces || 99, config.priceSauce || 0, 'ðŸ¯', 'bg-yellow-500/20 text-yellow-200');

    // --- EXTRAS (SIDES / DRINKS) ---
    if (currentOrder.extras && currentOrder.extras.length > 0) {
        let rows = '';
        currentOrder.extras.forEach(item => {
            total += item.price;
            let icon = 'âœ¨';
            if (item.category === 'drink') icon = 'ðŸ¥¤';
            if (item.category === 'side') icon = 'ðŸ¥¢';
            if (item.category === 'dessert') icon = 'ðŸ°';

            rows += `
                <div class="flex items-center justify-between p-2 rounded-lg bg-white/5 mb-1 border border-white/10">
                    <div class="flex items-center gap-3">
                         <div class="w-8 h-8 rounded-full bg-purple-500/20 text-purple-200 flex items-center justify-center text-sm shrink-0">
                            ${icon}
                        </div>
                        <span class="font-medium text-sm text-white/90">${item.name}</span>
                    </div>
                    <span class="text-xs text-yoko-accent font-bold">+$${item.price}</span>
                </div>`;
        });

        html += `
            <div class="py-2 border-b border-white/10">
                <div class="flex justify-between items-center mb-2">
                     <span class="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Extras & Bebidas</span>
                </div>
                <div class="space-y-0.5">${rows}</div>
            </div>
         `;
    }

    // Empty State for Content
    if (!currentOrder.base && currentOrder.proteins.length === 0) {
        html = `
            <div class="flex flex-col items-center justify-center h-40 text-gray-400 opacity-60">
                <i class="fa-solid fa-bowl-food text-4xl mb-3"></i>
                <p>Tu bowl estÃ¡ vacÃ­o</p>
            </div>`;
    }


    // SMART SUMMARY FEEDBACK
    const statusDiv = document.getElementById('order-status');
    const orderBtn = document.getElementById('desktop-order-btn');
    const mobileOrderBtn = document.querySelector('#mobile-sticky button');

    // ... (rest of validation logic same as before, essentially) ...
    // Re-implementing compact validation logic to ensure it works with new flow

    if (missing.length > 0) {
        if (statusDiv) {
            statusDiv.className = 'mb-4 bg-orange-500/20 text-orange-200 px-3 py-2 rounded-lg text-xs font-bold border border-orange-500/30 flex items-center gap-2';
            statusDiv.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <span>Falta: ${missing.join(', ')}</span>`;
        }
        if (orderBtn) {
            orderBtn.disabled = true;
            orderBtn.classList.add('bg-gray-500', 'cursor-not-allowed', 'opacity-70');
            orderBtn.classList.remove('bg-yoko-accent', 'hover:bg-white', 'hover:text-yoko-accent');
        }
        if (mobileOrderBtn) {
            mobileOrderBtn.disabled = true;
            mobileOrderBtn.innerHTML = `Falta ${missing[0]} <i class="fa-solid fa-circle-exclamation ml-1"></i>`;
            mobileOrderBtn.classList.add('bg-gray-500', 'cursor-not-allowed', 'opacity-80', 'text-xs');
            mobileOrderBtn.classList.remove('bg-yoko-accent', 'hover:bg-white', 'hover:text-yoko-accent', 'font-bold');
        }
    } else {
        if (statusDiv) {
            statusDiv.className = 'mb-4 bg-green-500/20 text-green-200 px-3 py-2 rounded-lg text-xs font-bold border border-green-500/30 flex items-center gap-2';
            statusDiv.innerHTML = `<i class="fa-solid fa-check-circle"></i> <span>Â¡Listo!</span>`;
        }
        if (orderBtn) {
            orderBtn.disabled = false;
            orderBtn.onclick = scrollToSummaryMove; // Go to checkout logic
            orderBtn.innerHTML = `Finalizar Pedido <i class="fa-solid fa-arrow-right ml-2"></i>`;
            orderBtn.classList.remove('bg-gray-500', 'cursor-not-allowed', 'opacity-70');
            orderBtn.classList.add('bg-yoko-accent', 'hover:bg-white', 'hover:text-yoko-accent');
        }
        if (mobileOrderBtn) {
            mobileOrderBtn.disabled = false;
            // Mobile sticky usually just toggles summary, but inside summary it goes to checkout.
            // But the sticky itself is the trigger.
            mobileOrderBtn.innerHTML = `Ver Resumen <i class="fa-solid fa-receipt ml-1"></i>`;
            mobileOrderBtn.classList.remove('bg-gray-500', 'cursor-not-allowed', 'opacity-80', 'text-xs');
            mobileOrderBtn.classList.add('bg-yoko-accent', 'hover:bg-white', 'hover:text-yoko-accent', 'font-bold');
        }
    }

    const liveSummary = document.getElementById('live-summary');
    if (liveSummary) liveSummary.innerHTML = html;

    const mobileLiveSummary = document.getElementById('mobile-live-summary');
    if (mobileLiveSummary) mobileLiveSummary.innerHTML = html; // Sync mobile

    // Update Totals
    const totalEls = document.querySelectorAll('#total-price, #mobile-total');
    totalEls.forEach(el => {
        // Pop animation
        el.classList.remove('pop-price');
        void el.offsetWidth; // trigger reflow
        el.classList.add('pop-price');
        el.innerText = `$${total} `;
    });
}


function sendWhatsAppOrder() {
    // CONFETTI CELEBRATION
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2F5233', '#FF6B6B', '#D4AF37', '#ffffff'] // Brand colors
    });

    setTimeout(() => {
        const totalPrice = document.getElementById('total-price');
        const total = totalPrice ? totalPrice.innerText : '$0';

        let text = `ðŸ§¾ *NUEVO PEDIDO - YOKO POKE HOUSE* ðŸ§¾\n\n`;
        text += `_Hola, quiero pedir un Bowl personalizado:_\n\n`;

        if (currentOrder.base) {
            text += `ðŸš *BASE*\n  â€¢ ${currentOrder.base}\n\n`;
        }

        if (currentOrder.proteins.length) {
            text += `ðŸŸ *PROTEÃNAS*\n`;
            currentOrder.proteins.forEach(p => {
                let costInfo = p.price > 0 ? ` (+$${p.price})` : '';
                text += `  â€¢ ${p.name}${costInfo}\n`;
            });
            text += `\n`;
        }

        if (currentOrder.mixins.length) {
            text += `ðŸ¥— *MIXINS (${currentOrder.mixins.length})*\n`;
            currentOrder.mixins.forEach(m => {
                text += `  â€¢ ${m}\n`;
            });
            text += `\n`;
        }

        if (currentOrder.sauces.length) {
            text += `ðŸ¯ *SALSAS (${currentOrder.sauces.length})*\n`;
            currentOrder.sauces.forEach(s => {
                text += `  â€¢ ${s}\n`;
            });
            text += `\n`;
        }

        if (currentOrder.toppings.length) {
            text += `ðŸ¥œ *TOPPINGS*\n`;
            currentOrder.toppings.forEach(t => {
                text += `  â€¢ ${t}\n`;
            });
            text += `\n`;
        }

        text += `--------------------------------\n`;
        text += `ðŸ’° *TOTAL: ${total}*\n`;
        text += `ðŸ“ *UBICACIÃ“N:* ComitÃ¡n`;

        window.open(`https://wa.me/5219631371902?text=${encodeURIComponent(text)}`, '_blank');
    }, 1500); // Wait 1.5s for confetti before opening WhatsApp
}

function orderSignature(name, price) {
    let text = `ðŸ§¾ *NUEVO PEDIDO - YOKO POKE HOUSE* ðŸ§¾\n\n`;
    text += `Hola, quiero pedir un Signature Bowl:\n\n`;
    text += `ðŸ¥£ *${name.toUpperCase()}*\n`;
    text += `ðŸ’° *PRECIO:* $${price}\n\n`;
    text += `ðŸ“ *UBICACIÃ“N:* ComitÃ¡n`;
    window.open(`https://wa.me/5219631371902?text=${encodeURIComponent(text)}`, '_blank');
}

function scrollToBuilder() {
    const builderSection = document.getElementById('arma-tu-bowl');
    if (builderSection) builderSection.scrollIntoView({ behavior: 'smooth' });
}



// --- CHECKOUT LOGIC ---
let deliveryMethod = 'pickup'; // Default

function openCheckout() {
    renderCheckoutSummary();
    const view = document.getElementById('checkout-view');
    view.classList.remove('hidden');
    // Force reflow
    void view.offsetWidth;
    view.classList.remove('translate-x-full');

    // Push State for Back Button handling
    history.pushState({ page: 'checkout' }, 'Checkout', '#checkout');
}

function goBackToBuilder() {
    const view = document.getElementById('checkout-view');
    view.classList.add('translate-x-full');
    setTimeout(() => {
        view.classList.add('hidden');
    }, 300);

    // Remove hash if present
    if (window.location.hash === '#checkout') {
        history.back();
    }
}

// Handle Browser Back Button
window.onpopstate = function (event) {
    const view = document.getElementById('checkout-view');
    if (view && !view.classList.contains('hidden')) {
        // Close manually without calling history.back() again
        view.classList.add('translate-x-full');
        setTimeout(() => {
            view.classList.add('hidden');
        }, 300);
    }
};

function scrollToSummaryMove() {
    // Overriding old behavior: Go Straight to Checkout
    openCheckout();
}

// Override Mobile Sticky Button
function toggleMobileSummary() {
    openCheckout();
}

function setDeliveryMethod(method) {
    deliveryMethod = method;
    const btnPickup = document.getElementById('btn-pickup');
    const btnDelivery = document.getElementById('btn-delivery');
    const deliveryFields = document.getElementById('delivery-fields');

    if (method === 'pickup') {
        // UI Tabs
        btnPickup.classList.add('bg-white', 'text-yoko-dark', 'shadow-sm');
        btnPickup.classList.remove('text-gray-500');

        btnDelivery.classList.remove('bg-white', 'text-yoko-dark', 'shadow-sm');
        btnDelivery.classList.add('text-gray-500');

        // Hide Fields
        deliveryFields.classList.add('hidden');
    } else {
        // UI Tabs
        btnDelivery.classList.add('bg-white', 'text-yoko-dark', 'shadow-sm');
        btnDelivery.classList.remove('text-gray-500');

        btnPickup.classList.remove('bg-white', 'text-yoko-dark', 'shadow-sm');
        btnPickup.classList.add('text-gray-500');

        // Show Fields
        deliveryFields.classList.remove('hidden');
    }
}

function renderCheckoutSummary() {
    const summaryContainer = document.getElementById('checkout-summary');
    const totalEl = document.getElementById('checkout-total');
    const totalFooterEl = document.getElementById('checkout-total-footer');
    const totalPrice = document.getElementById('total-price').innerText;

    totalEl.innerText = totalPrice;
    if (totalFooterEl) totalFooterEl.innerText = totalPrice; // Sync footer total

    let html = '';

    // Helper to get icon
    const getIcon = (type, name) => {
        const item = menu[type].find(i => i.name === name);
        return item ? item.icon : 'â€¢';
    };

    // Base with icon
    if (currentOrder.base) {
        const icon = getIcon('bases', currentOrder.base);
        html += `
            <div class="flex items-center gap-2 py-1.5 border-b border-gray-100">
                <span class="text-lg">${icon}</span>
                <div class="flex-1">
                    <span class="text-xs text-gray-400 uppercase tracking-wide block">Base</span>
                    <span class="font-bold text-sm">${currentOrder.base}</span>
                </div>
            </div>`;
    }

    // Proteins with icons
    if (currentOrder.proteins.length) {
        html += `<div class="py-1.5 border-b border-gray-100">
            <span class="text-xs text-gray-400 uppercase tracking-wide block mb-1">ProteÃ­nas</span>
            <div class="space-y-1">`;
        currentOrder.proteins.forEach(p => {
            const icon = getIcon('proteins', p.name);
            html += `
                <div class="flex items-center gap-2">
                    <span class="text-base">${icon}</span>
                    <span class="font-semibold text-sm">${p.name}</span>
                </div>`;
        });
        html += `</div></div>`;
    }

    // Mixins with icons
    if (currentOrder.mixins.length) {
        html += `<div class="py-1.5 border-b border-gray-100">
            <span class="text-xs text-gray-400 uppercase tracking-wide block mb-1">Mixins</span>
            <div class="flex flex-wrap gap-2">`;
        currentOrder.mixins.forEach(name => {
            const icon = getIcon('mixins', name);
            html += `<span class="bg-green-50 text-green-700 px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                        ${icon} ${name}
                    </span>`;
        });
        html += `</div></div>`;
    }

    // Sauces with icons
    if (currentOrder.sauces.length) {
        html += `<div class="py-1.5 border-b border-gray-100">
            <span class="text-xs text-gray-400 uppercase tracking-wide block mb-1">Salsas</span>
            <div class="flex flex-wrap gap-2">`;
        currentOrder.sauces.forEach(name => {
            const icon = getIcon('sauces', name);
            html += `<span class="bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                        ${icon} ${name}
                    </span>`;
        });
        html += `</div></div>`;
    }

    // Toppings with icons
    if (currentOrder.toppings.length) {
        html += `<div class="py-1.5">
            <span class="text-xs text-gray-400 uppercase tracking-wide block mb-1">Toppings</span>
            <div class="flex flex-wrap gap-2">`;
        currentOrder.toppings.forEach(name => {
            const icon = getIcon('toppings', name);
            html += `<span class="bg-orange-50 text-orange-700 px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                        ${icon} ${name}
                    </span>`;
        });
        html += `</div></div>`;
    }

    summaryContainer.innerHTML = html;
    renderCheckoutUpsell();
}

function submitOrder() {
    // 1. Validate Form
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();

    if (!name || !phone) {
        showToast('Por favor, ingresa tu Nombre y TelÃ©fono', 'ðŸ“‹');
        return;
    }

    let address = '';
    let refs = '';

    if (deliveryMethod === 'delivery') {
        address = document.getElementById('cust-address').value.trim();
        const neighborhood = document.getElementById('cust-neighborhood').value.trim();
        refs = document.getElementById('cust-refs').value.trim();

        if (!address || !neighborhood) {
            showToast('Ingresa la DirecciÃ³n de entrega', 'ðŸ“');
            return;
        }
        address = `${address}, ${neighborhood}`;
    }

    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;

    // 2. Build Message
    const totalPrice = document.getElementById('total-price').innerText;

    let text = `ðŸ§¾ *NUEVO PEDIDO - YOKO POKE HOUSE* ðŸ§¾\n\n`;

    // Product Info
    const productName = currentProduct.type === 'bowl' ? 'Poke Bowl' : 'Sushi Burger';
    const sizeName = SIZE_CONFIG[currentProduct.size]?.name || 'Mediano';
    const productIcon = currentProduct.type === 'bowl' ? 'ðŸ¥£' : 'ðŸ”';
    text += `${productIcon} *PRODUCTO:* ${productName} ${sizeName}\n`;
    text += `ðŸ’µ *PRECIO BASE:* $${currentProduct.basePrice}\n\n`;

    // Customer Info
    text += `ðŸ‘¤ *CLIENTE:* ${name}\n`;
    text += `ðŸ“± *TEL:* ${phone}\n`;
    text += `ðŸšš *ENTREGA:* ${deliveryMethod === 'delivery' ? 'A DOMICILIO ðŸ›µ' : 'RECOGER EN SUCURSAL ðŸª'}\n`;

    if (deliveryMethod === 'delivery') {
        text += `ðŸ“ *DIRECCIÃ“N:* ${address}\n`;
        if (refs) text += `â„¹ï¸ *REF:* ${refs}\n`;
    }

    text += `ðŸ’³ *PAGO:* ${paymentMethod}\n\n`;

    text += `--------------------------------\n`;
    text += `ðŸ¥£ *DETALLE DEL PEDIDO:*\n\n`;

    if (currentOrder.base) text += `ðŸš *BASE:* ${currentOrder.base}\n`;

    if (currentOrder.proteins.length) {
        text += `ðŸŸ *PROTEÃNAS:*\n`;
        currentOrder.proteins.forEach(p => {
            let costInfo = p.price > 0 ? ` (+ $${p.price})` : '';
            text += `   â€¢ ${p.name}${costInfo}\n`;
        });
    }

    if (currentOrder.mixins.length) text += `ðŸ¥— *MIXINS:* ${currentOrder.mixins.join(', ')}\n`;
    if (currentOrder.sauces.length) text += `ðŸ¯ *SALSAS:* ${currentOrder.sauces.join(', ')}\n`;
    if (currentOrder.toppings.length) text += `ðŸ¥œ *TOPPINGS:* ${currentOrder.toppings.join(', ')}\n`;

    text += `\nðŸ’° *TOTAL A PAGAR: ${totalPrice}*`;

    // 3. Save to Supabase (Analytics & History)
    const orderData = {
        customer_name: name,
        customer_phone: phone,
        delivery_method: deliveryMethod,
        total: parseFloat(totalPrice.replace('$', '')),
        order_details: {
            product: currentProduct,
            ingredients: currentOrder,
            address: address,
            payment: paymentMethod
        },
        status: 'pending'
    };

    try {
        // Non-blocking save to avoid stopping the user flow
        supabase.from('orders').insert([orderData]).then(({ error }) => {
            if (error) console.error('Error saving order:', error);
        });
    } catch (err) {
        console.error('Supabase error', err);
    }


    // 4. Send via WhatsApp
    window.open(`https://wa.me/5219631371902?text=${encodeURIComponent(text)}`, '_blank');

    // 5. Reset App after delay
    setTimeout(() => {
        resetApp();
    }, 2000);
}

// Reset Application State
function resetApp() {
    // 1. Reset Data
    currentOrder = {
        base: null,
        proteins: [],
        mixins: [],
        sauces: [],
        toppings: [],
        extras: [],
        crunches: []
    };
    currentStep = 0;

    // Reset product selection
    currentProduct = {
        type: null,
        size: null,
        basePrice: 170,
        limits: {
            mixins: 4,
            sauces: 2,
            priceMixin: 10,
            priceSauce: 10
        }
    };

    // 2. Clear Storage
    localStorage.removeItem('yoko_order');
    localStorage.removeItem('yoko_step');

    // 3. Reset UI - Form
    document.getElementById('cust-name').value = '';
    document.getElementById('cust-phone').value = '';
    document.getElementById('cust-address').value = '';
    document.getElementById('cust-neighborhood').value = '';
    document.getElementById('cust-refs').value = '';

    // 4. Reset UI - Views
    goBackToBuilder(); // Close checkout

    // Hide builder, show product selector
    document.getElementById('arma-tu-bowl').classList.add('hidden');
    document.getElementById('product-selector').classList.remove('hidden');

    // Reset product selection UI
    document.querySelectorAll('.product-card').forEach(card => {
        card.classList.remove('border-yoko-primary');
        card.classList.add('border-transparent');
    });
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.classList.remove('border-yoko-primary', 'bg-green-50');
        btn.classList.add('border-transparent', 'bg-gray-100');
    });
    const startBtn = document.getElementById('start-builder-btn');
    startBtn.disabled = true;
    startBtn.classList.add('bg-gray-400', 'cursor-not-allowed', 'opacity-50');
    startBtn.classList.remove('bg-yoko-primary', 'hover:bg-yoko-dark', 'cursor-pointer');

    updateUIState();   // Clear checkboxes
    renderSummary();   // Clear sticky summary
    updateWizardUI();  // Reset wizard progress bar to step 0

    // 5. Scroll to product selector
    document.getElementById('product-selector').scrollIntoView({ behavior: 'smooth' });

    showToast('Pedido Enviado. Â¡Gracias!', 'âœ…');
}

// --- HELPER FUNCTIONS FOR CART/EDIT ---

// Edit Action: Close cart/checkout and jump to step
function editItem(stepIndex) {
    goBackToBuilder();

    // Jump to step
    currentStep = stepIndex;
    updateWizardUI();

    // Scroll to wizard
    setTimeout(() => {
        const wizard = document.getElementById('step-0').parentElement;
        if (wizard) wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// Remove Action: Remove specific item
function removeItem(type, name) {
    const arr = currentOrder[type];
    const index = arr.indexOf(name);
    if (index > -1) {
        arr.splice(index, 1);
        saveOrderToStorage();
        updateUIState(); // Update checkboxes in BG
        renderSummary(); // Update passive summary
        if (document.getElementById('checkout-view').classList.contains('hidden') === false) {
            renderCheckoutSummary();
        }
        playSound('pop');
        showToast('Eliminado', 'ðŸ—‘ï¸');
    }
}

// Mobile Menu Logic
const mobileMenu = document.getElementById('mobile-menu');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const closeMenuBtn = document.getElementById('close-menu');

if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.add('open');
        mobileMenuBtn.classList.add('active'); // Animate hamburger
    });
}

const closeMenu = () => {
    if (mobileMenu) mobileMenu.classList.remove('open');
    if (mobileMenuBtn) mobileMenuBtn.classList.remove('active'); // Reset hamburger
}

if (closeMenuBtn) {
    closeMenuBtn.addEventListener('click', closeMenu);
}

// --- NAVBAR SCROLL EFFECT ---
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const navbar = document.getElementById('main-nav');

    // Add shadow effect when scrolled
    if (scrolled > 50) {
        navbar?.classList.add('scrolled');
    } else {
        navbar?.classList.remove('scrolled');
    }

    // Parallax effect
    document.querySelectorAll('.parallax-element').forEach(el => {
        const speed = el.getAttribute('data-speed');
        if (speed) {
            el.style.transform = `translateY(${scrolled * speed}px)`;
        }
    });

    // Scroll Spy active state
    updateActiveLink();

    lastScroll = scrolled;
});

// --- SCROLL SPY ---
function updateActiveLink() {
    const sections = ['inicio', 'menu', 'ubicacion'];
    const navLinks = document.querySelectorAll('nav a[href^="#"]');

    let current = '';

    sections.forEach(section => {
        const element = document.getElementById(section);
        if (element) {
            const sectionTop = element.offsetTop;
            if (window.scrollY >= (sectionTop - 200)) {
                current = section;
            }
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('text-yoko-accent');
        link.classList.remove('text-yoko-dark'); // Re-add default if needed
        link.classList.add('text-yoko-dark');

        // Reset the underline overlay width
        const span = link.querySelector('span');
        if (span) span.style.width = '0';

        if (link.getAttribute('href') === `#${current}`) {
            link.classList.remove('text-yoko-dark');
            link.classList.add('text-yoko-accent');
            if (span) span.style.width = '100%';
        }
    });
}

// --- AUDIO SYSTEM (Procedural / No Assets) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'pop') {
        // Soft Pop (Sine wave, quick decay)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now); // Low volume
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'click') {
        // High click
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'success') {
        // Celebration Chord (Arpeggio)
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major
        notes.forEach((freq, i) => {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);

            const start = now + (i * 0.05);
            osc2.frequency.value = freq;
            gain2.gain.setValueAtTime(0, start);
            gain2.gain.linearRampToValueAtTime(0.2, start + 0.05);
            gain2.gain.exponentialRampToValueAtTime(0.01, start + 0.4);

            osc2.start(start);
            osc2.stop(start + 0.5);
        });
    }
}

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    initBuilder();
    updateActiveLink();

    // Defer Tilt init slightly to ensure DOM is ready
    setTimeout(initTilt, 100);

    // Add sound to native buttons
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => playSound('click'));
    });

    // --- SPLASH SCREEN LOGIC ---
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.remove(); // Remove from DOM after fade out
                // Force AOS refresh to ensure positions are recalculated after splash removal
                setTimeout(() => AOS.refresh(), 100);
            }, 700);
        }
    }, 2000); // Show splash for 2s

    // --- BUTTON RIPPLE EFFECT ---
    const buttons = document.querySelectorAll('button, .btn-ripple');
    buttons.forEach(btn => {
        btn.classList.add('relative', 'overflow-hidden'); // Ensure container style
        btn.addEventListener('click', function (e) {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;

            this.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
});

// --- SCROLL PROGRESS & RIPPLE EFFECTS ---
window.addEventListener('scroll', () => {
    const totalHeight = document.body.scrollHeight - window.innerHeight;
    const progress = (window.scrollY / totalHeight) * 100;
    const bar = document.getElementById('scroll-progress');
    if (bar) bar.style.width = `${progress}%`;
});

// --- TOAST NOTIFICATION SYSTEM ---
// --- PREMIUM TOAST SYSTEM ---
function showToast(message, icon = 'âœ…') {
    // 1. Container Management
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        // Responsive Positioning:
        // Mobile: Fixed Top Center (Dynamic Island style)
        // Desktop: Fixed Bottom Right
        container.className = 'fixed z-[10000] flex flex-col gap-3 pointer-events-none ' +
            'top-4 left-1/2 -translate-x-1/2 w-[90vw] max-w-sm ' + // Mobile
            'lg:top-auto lg:left-auto lg:bottom-8 lg:right-8 lg:translate-x-0 lg:w-auto lg:items-end'; // Desktop
        document.body.appendChild(container);
    }

    // 2. Create Toast Element
    const toast = document.createElement('div');
    // Glassmorphism + Gradle + Border
    toast.className = 'flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border border-white/10 ' +
        'bg-neutral-900/90 text-white transform transition-all duration-500 will-change-transform ' +
        'translate-y-[-20px] opacity-0 scale-95 pointer-events-auto cursor-pointer hover:bg-neutral-800';

    // Status color indicator line
    const statusColor = message.includes('Eliminado') ? 'bg-red-500' : 'bg-yoko-accent';

    toast.innerHTML = `
        <div class="shrink-0 w-10 h-10 rounded-full ${statusColor}/20 flex items-center justify-center text-xl">
            ${icon}
        </div>
        <div class="flex flex-col">
            <span class="font-bold text-sm leading-tight text-white/90">${message}</span>
            <span class="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">Notificaciòn</span>
        </div>
        <div class="w-1 h-8 rounded-full ${statusColor} ml-2"></div>
    `;

    // 4. Auto Dimsiss and Stack Management
    // Remove older toasts to prevent stacking overlap annoyance
    while (container.children.length > 0) {
        container.removeChild(container.firstChild);
    }

    container.appendChild(toast);

    // Trigger Animation (Next Frame)
    // Force reflow
    void toast.offsetWidth;

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-[-20px]', 'opacity-0', 'scale-95');
        toast.classList.add('translate-y-0', 'opacity-100', 'scale-100');
    });

    // Interactions
    toast.onclick = () => removeToast(toast);

    // 4. Auto Dimsiss
    // Store timeout ID to clear if hovered (optional feature, keeping simple for now)
    setTimeout(() => {
        removeToast(toast);
    }, 4000);
}

function removeToast(el) {
    if (!el) return;
    el.classList.add('opacity-0', 'scale-90', 'translate-y-[-20px]'); // Float up and fade
    setTimeout(() => {
        if (el.parentElement) el.remove();
    }, 500); // Wait for transition
}

// --- HELPER UI FUNCTIONS ---
function updateSizeButtons() {
    const updateBtn = (id, key) => {
        const button = document.querySelector(`button[onclick="selectSize(event, '${id}')"]`);
        if (button) {
            if (SIZE_CONFIG[key]) {
                const priceSpan = button.querySelector('div:last-child');
                if (priceSpan) priceSpan.innerText = `$${SIZE_CONFIG[key].basePrice}`;

                // If the key was created as a fallback (and we want to hide if not in DB), we could check here.
                // But for now, we just update price. 
            }
        }
    };

    updateBtn('small', 'small');
    updateBtn('medium', 'medium');
    updateBtn('large', 'large');
    updateBtn('regular', 'regular');
}
// --- EXPOSE FUNCTIONS TO WINDOW (REQUIRED FOR MODULES) ---
window.selectProductType = selectProductType;
window.selectSize = selectSize;
window.startBuilder = startBuilder;
window.changeStep = changeStep;
window.updateOrder = updateOrder;
window.flyToCart = flyToCart;
window.flyBackToCard = flyBackToCard;
window.sendWhatsAppOrder = sendWhatsAppOrder;
// toggleExtra is already assigned to window in its definition
if (typeof scrollToSummaryMove !== 'undefined') window.scrollToSummaryMove = scrollToSummaryMove;

// --- NEW PRO CHECKOUT LOGIC ---

window.toggleAddress = function (show) {
    const field = document.getElementById('cust-address');
    if (show) {
        field.classList.remove('hidden');
        field.focus();
    } else {
        field.classList.add('hidden');
    }
}

window.closeCheckout = function () {
    // Close modal (mobile)
    const modal = document.getElementById('checkout-modal');
    if (modal && !modal.classList.contains('hidden')) {
        document.getElementById('checkout-backdrop')?.classList.add('opacity-0');
        document.getElementById('checkout-content')?.classList.add('translate-y-full');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }

    // Close fullscreen view (desktop)
    const view = document.getElementById('checkout-view');
    if (view && !view.classList.contains('translate-x-full')) {
        view.classList.add('translate-x-full');
        setTimeout(() => {
            view.classList.add('hidden');
        }, 300);
    }
}

window.goBackToBuilder = function () {
    closeCheckout();
}

// Override/Define submitOrder to show responsive checkout
window.submitOrder = function () {
    // Check if mobile or desktop
    const isMobile = window.innerWidth < 1024; // lg breakpoint

    // Get Total
    let totalText = '$0';
    const totalEl = document.getElementById('summary-total') || document.getElementById('total-price') || document.getElementById('checkout-total-footer');
    if (totalEl) totalText = totalEl.innerText;

    if (isMobile) {
        // MOBILE: Show modal (bottom sheet)
        document.getElementById('checkout-total-modal').innerText = totalText;

        const modal = document.getElementById('checkout-modal');
        modal.classList.remove('hidden');

        // Animate
        setTimeout(() => {
            document.getElementById('checkout-backdrop').classList.remove('opacity-0');
            document.getElementById('checkout-content').classList.remove('translate-y-full');
        }, 10);
    } else {
        // DESKTOP: Show fullscreen view (2 columns)
        document.getElementById('checkout-total').innerText = totalText;
        document.getElementById('checkout-total-footer').innerText = totalText;

        // Populate summary
        populateCheckoutSummary();

        // Show view
        const view = document.getElementById('checkout-view');
        view.classList.remove('hidden');
        setTimeout(() => {
            view.classList.remove('translate-x-full');
        }, 10);
    }
}

function populateCheckoutSummary() {
    const summaryEl = document.getElementById('checkout-summary');
    if (!summaryEl) return;

    let html = '';
    // bowl/burger info
    if (currentOrder) {
        const base = currentOrder.base || '';
        const proteins = currentOrder.proteins?.join(', ') || '';
        const toppings = currentOrder.toppings?.join(', ') || '';

        html += `<div class="mb-2"><strong>${currentOrder.category || 'Item'}</strong> - ${currentOrder.size || ''}</div>`;
        if (base) html += `<p class="text-xs">Base: ${base}</p>`;
        if (proteins) html += `<p class="text-xs">ProteÃ­nas: ${proteins}</p>`;
        if (toppings) html += `<p class="text-xs">Toppings: ${toppings}</p>`;
    }

    summaryEl.innerHTML = html || '<p class="text-gray-400 italic">Carrito vacÃ­o</p>';
}

window.confirmRealOrder = async function () {
    const btn = document.getElementById('btn-confirm-real');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

    // 1. Validation
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const deliveryMethod = document.querySelector('input[name="delivery-method"]:checked').value;
    const address = document.getElementById('cust-address').value.trim();
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;

    if (!name || !phone || (deliveryMethod === 'delivery' && !address)) {
        alert('Por favor completa todos los campos requeridos (Nombre, TelÃ©fono y DirecciÃ³n si es envÃ­o).');
        btn.innerHTML = originalText;
        return;
    }

    // 2. Build Payload
    // We assume 'currentOrder' global var holds the state (ingredients, etc.)
    // We also need to capture the Extras if they are stored separately.
    // Ideally we'd look at the UI or a specific state object.
    // For now, let's dump 'currentOrder' which seems to comprise the main item.

    let dbItems = [];

    // Add Main Item (Bowl/Burger)
    if (currentOrder) {
        dbItems.push({
            type: 'main',
            details: currentOrder
        });
    }

    // Parse Total
    const totalPrice = parseFloat(document.getElementById('checkout-total-modal').innerText.replace('$', '').replace(',', '')) || 0;

    const payload = {
        customer_name: name,
        customer_phone: phone,
        delivery_address: deliveryMethod === 'delivery' ? address : 'Recoger en Tienda',
        items: dbItems, // This column is JSONB, so it's flexible
        total: totalPrice,
        status: 'pending',
        // We can add a metadata column or just append to notes
        // payment_method is not in schema yet, let's add it to items or ignore for now (or migration needed)
        // Let's assume schema matches or we put it in address context
    };

    // Hack: Append Payment Method to Address for admin visibility without schema change
    payload.delivery_address += ` | Pago: ${paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}`;

    // 3. Insert to Supabase
    const { data, error } = await supabase
        .from('orders')
        .insert([payload])
        .select();

    if (error) {
        console.error('Order Error:', error);
        alert('Hubo un problema al enviar tu pedido. Por favor intenta de nuevo.');
        btn.innerHTML = originalText;
    } else {
        // 4. Success
        const orderId = data[0].id; // e.g. 12
        // Format ID
        const padId = '#' + orderId.toString().padStart(5, '0');
        document.getElementById('success-order-id').innerText = padId;

        // Close Checkout
        window.closeCheckout();

        // Show Success
        const successOverlay = document.getElementById('success-overlay');
        successOverlay.classList.remove('hidden');
        successOverlay.classList.add('flex'); // It's a flex container

        // Optional: Trigger WhatsApp as backup/receipt
        // we can add a button in success screen for that if user wants
    }
}
// Desktop-specific functions
window.setDeliveryMethod = function (method) {
    const pickupBtn = document.getElementById('btn-pickup');
    const deliveryBtn = document.getElementById('btn-delivery');
    const deliveryFields = document.getElementById('delivery-fields');

    if (method === 'pickup') {
        // Style buttons
        pickupBtn.className = 'flex-1 py-3 rounded-lg transition-all duration-300 bg-white text-yoko-dark shadow-sm';
        deliveryBtn.className = 'flex-1 py-3 rounded-lg transition-all duration-300 text-gray-500 hover:text-yoko-dark';

        // Hide delivery fields with animation
        deliveryFields.classList.add('max-h-0', 'opacity-0');
        deliveryFields.classList.remove('max-h-[500px]', 'opacity-100');
        setTimeout(() => {
            deliveryFields.classList.add('hidden');
        }, 500);
    } else {
        // Style buttons
        pickupBtn.className = 'flex-1 py-3 rounded-lg transition-all duration-300 text-gray-500 hover:text-yoko-dark';
        deliveryBtn.className = 'flex-1 py-3 rounded-lg transition-all duration-300 bg-white text-yoko-dark shadow-sm';

        // Show delivery fields with animation
        deliveryFields.classList.remove('hidden');
        setTimeout(() => {
            deliveryFields.classList.remove('max-h-0', 'opacity-0');
            deliveryFields.classList.add('max-h-[500px]', 'opacity-100');
        }, 10);
    }
}

// Desktop order confirmation
window.confirmDesktopOrder = async function () {
    const btn = event.target.closest('button');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
    btn.disabled = true;

    // Get form values
    const name = document.getElementById('cust-name-desktop').value.trim();
    const phone = document.getElementById('cust-phone-desktop').value.trim();
    const deliveryMethod = document.querySelector('#btn-delivery').classList.contains('bg-white') ? 'delivery' : 'pickup';
    const paymentMethod = document.querySelector('#checkout-view input[name="payment-method"]:checked')?.value || 'Efectivo';

    // Build address string
    let address = '';
    if (deliveryMethod === 'delivery') {
        const street = document.getElementById('cust-address-desktop').value.trim();
        const neighborhood = document.getElementById('cust-neighborhood-desktop').value.trim();
        const refs = document.getElementById('cust-refs-desktop').value.trim();

        if (!street || !neighborhood) {
            alert('Por favor completa la direcciÃ³n de entrega.');
            btn.innerHTML = originalHTML;
            btn.disabled = false;
            return;
        }

        address = `${street}, ${neighborhood}${refs ? ' - ' + refs : ''}`;
    } else {
        address = 'Recoger en Tienda';
    }

    if (!name || !phone) {
        alert('Por favor completa tu nombre y telÃ©fono.');
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        return;
    }

    // Build order payload
    let dbItems = [];
    if (currentOrder) {
        dbItems.push({
            type: 'main',
            details: currentOrder
        });
    }

    const totalText = document.getElementById('checkout-total').innerText.replace('$', '').replace(',', '');
    const totalPrice = parseFloat(totalText) || 0;

    const payload = {
        customer_name: name,
        customer_phone: phone,
        delivery_address: `${address} | Pago: ${paymentMethod}`,
        items: dbItems,
        total: totalPrice,
        status: 'pending'
    };

    // Insert to Supabase
    const { data, error } = await supabase
        .from('orders')
        .insert([payload])
        .select();

    if (error) {
        console.error('Order Error:', error);
        alert('Hubo un problema al enviar tu pedido. Por favor intenta de nuevo.');
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    } else {
        // Success
        const orderId = data[0].id;
        const padId = '#' + orderId.toString().padStart(5, '0');
        document.getElementById('success-order-id').innerText = padId;

        // Close checkout
        window.closeCheckout();

        // Show success overlay
        const successOverlay = document.getElementById('success-overlay');
        successOverlay.classList.remove('hidden');
        successOverlay.classList.add('flex');

        // Reset form
        document.getElementById('cust-name-desktop').value = '';
        document.getElementById('cust-phone-desktop').value = '';
        document.getElementById('cust-address-desktop').value = '';
        document.getElementById('cust-neighborhood-desktop').value = '';
        document.getElementById('cust-refs-desktop').value = '';

        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

// --- CHECKOUT STEPPER LOGIC (MOBILE) ---
let currentCheckoutStep = 1;

window.nextCheckoutStep = function() {
    // Validate Step 1
    if (currentCheckoutStep === 1) {
        const name = document.getElementById('cust-name').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();
        if (!name || !phone) {
            // Simple alert/toast fallback if showToast is not available or just alert
            alert('Por favor completa tu nombre y tel�fono');
            return;
        }
    }

    // Go to next
    if (currentCheckoutStep < 3) {
        currentCheckoutStep++;
        updateCheckoutUI();
    }
}

window.prevCheckoutStep = function() {
    if (currentCheckoutStep > 1) {
        currentCheckoutStep--;
        updateCheckoutUI();
    }
}

function updateCheckoutUI() {
    // 1. Update Progress Bar
    for(let i=1; i<=3; i++) {
        const el = document.getElementById('prog-'+i);
        if(!el) continue;
        if(i <= currentCheckoutStep) {
            el.classList.remove('bg-gray-100');
            el.classList.add('bg-yoko-primary');
        } else {
            el.classList.add('bg-gray-100');
            el.classList.remove('bg-yoko-primary');
        }
    }

    // 2. toggle Steps
    for(let i=1; i<=3; i++) {
        const stepEl = document.getElementById('chk-step-'+i);
        if(!stepEl) continue;
        if(i === currentCheckoutStep) {
            stepEl.classList.remove('hidden', 'opacity-0', 'translate-x-[100%]', '-translate-x-[100%]');
        } else if(i < currentCheckoutStep) {
             // Previous steps move to left
             stepEl.classList.add('hidden', 'opacity-0', '-translate-x-[100%]');
             stepEl.classList.remove('translate-x-[100%]');
        } else {
             // Next steps move to right
             stepEl.classList.add('hidden', 'opacity-0', 'translate-x-[100%]');
             stepEl.classList.remove('-translate-x-[100%]');
        }
    }

    // 3. Buttons & Title
    const btnNext = document.getElementById('btn-next-step');
    const btnFinal = document.getElementById('btn-confirm-final');
    const btnBack = document.getElementById('btn-back-checkout');
    const title = document.getElementById('checkout-title');

    // Back button visibility
    if(btnBack) {
        if(currentCheckoutStep === 1) {
            btnBack.disabled = true;
            btnBack.classList.remove('opacity-100');
            btnBack.classList.add('opacity-0');
        } else {
            btnBack.disabled = false;
            btnBack.classList.add('opacity-100');
            btnBack.classList.remove('opacity-0');
        }
    }

    // Main Button Logic
    if(btnNext && btnFinal && title) {
        if(currentCheckoutStep === 3) {
            btnNext.classList.add('hidden');
            btnFinal.classList.remove('hidden');
            title.innerText = 'Confirmar';
        } else {
            btnNext.classList.remove('hidden');
            btnFinal.classList.add('hidden');
            title.innerText = currentCheckoutStep === 1 ? 'Tus Datos' : 'Entrega';
        }
    }
}

// Override open checkout to reset step
const oldSubmitOrder = window.submitOrder;
window.submitOrder = function() {
    currentCheckoutStep = 1;
    updateCheckoutUI();
    if(oldSubmitOrder) oldSubmitOrder();
}


// --- FULL SCREEN CHECKOUT LOGIC ---
window.setDeliveryMode = function(mode) {
    const bg = document.getElementById('toggle-bg');
    const input = document.getElementById('delivery-mode-input');
    const addrSection = document.getElementById('address-section');
    
    if(!bg || !input) return;

    input.value = mode;

    if(mode === 'pickup') {
        bg.style.left = '4px';
        addrSection.classList.add('hidden');
    } else {
        bg.style.left = 'calc(50% + 2px)';
        addrSection.classList.remove('hidden');
    }
}

window.confirmRealOrderFull = function() {
    const name = document.getElementById('cust-name-full').value.trim();
    const phone = document.getElementById('cust-phone-full').value.trim();
    const deliveryMode = document.getElementById('delivery-mode-input').value;
    const address = document.getElementById('cust-address-full').value.trim();
    
    if(!name || !phone) {
        alert('Por favor ingresa tu nombre y tel�fono.');
        return;
    }

    if(deliveryMode === 'delivery' && !address) {
        alert('Por favor ingresa la direcci�n de entrega.');
        return;
    }

    // Success Simulation
    const view = document.getElementById('checkout-view');
    view.classList.add('hidden');
    
    const orderId = Math.floor(1000 + Math.random() * 9000);
    document.getElementById('success-order-id').innerText = orderId;
    document.getElementById('success-overlay').classList.remove('hidden');
    document.getElementById('success-overlay').classList.add('flex');
}

// Override submitOrder for Full Screen Version
window.submitOrder = function() {
    const view = document.getElementById('checkout-view');
    view.classList.remove('hidden');
    
    // Populate summary if possible
    if(currentOrder) {
        document.getElementById('summary-price').innerText = document.getElementById('summary-total')?.innerText || '';
        // document.getElementById('summary-main-item').innerText = currentOrder.category ...
    }
}

