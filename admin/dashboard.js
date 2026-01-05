
import { supabase } from '../supabaseClient.js';

// --- AUTH & STATE ---
const PIN = '1234'; // Simple PIN for MVP
const PIN_KEY = 'yoko_admin_auth';
let currentOrders = []; // Store locally for stats

// --- UI INIT ---
checkAuth();

// Event Listeners
const loginBtn = document.getElementById('login-btn');
if (loginBtn) loginBtn.addEventListener('click', login);

// Auto-focus logic for PIN
const pinInput = document.getElementById('admin-pin');
if (pinInput) {
    pinInput.focus();
    pinInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') login();
    });
}

// Global exposure
window.switchTab = switchTab;
window.logout = logout;
window.fetchOrders = fetchOrders;
window.toggleAvailability = toggleAvailability;
window.updateOrderStatus = updateOrderStatus;
window.editMenuItem = editMenuItem;
window.openModal = openModal;
window.closeModal = closeModal;

// --- AUTHENTICATION ---
function checkAuth() {
    const isAuth = localStorage.getItem(PIN_KEY) === 'true';
    if (isAuth) {
        document.getElementById('auth-overlay').classList.add('hidden');
        document.getElementById('admin-app').classList.remove('hidden');
        initDashboard();
    }
}

function login() {
    const input = document.getElementById('admin-pin');
    if (input.value === PIN) {
        localStorage.setItem(PIN_KEY, 'true');
        location.reload();
    } else {
        document.getElementById('login-msg').classList.remove('hidden');
        input.classList.add('border-red-500');
        setTimeout(() => {
            input.classList.remove('border-red-500');
            input.value = '';
        }, 1000);
    }
}

function logout() {
    localStorage.removeItem(PIN_KEY);
    location.reload();
}

// --- DASHBOARD CORE ---
function switchTab(tabId) {
    // Buttons Desktop
    const tabOrders = document.getElementById('tab-orders-desktop');
    const tabMenu = document.getElementById('tab-menu-desktop');

    // Buttons Mobile
    const tabOrdersMobile = document.getElementById('tab-orders-mobile');
    const tabMenuMobile = document.getElementById('tab-menu-mobile');

    // Reset Classes Helper
    const setActive = (el, active) => {
        if (!el) return;
        if (active) {
            el.className = el.className.replace('text-gray-500 hover:bg-gray-50', 'bg-yoko-primary text-white shadow-md').replace('text-gray-400', 'text-yoko-primary');
            if (el.id.includes('mobile')) el.className = 'flex flex-col items-center p-2 text-yoko-primary transition-colors flex-1';
        } else {
            el.className = el.className.replace('bg-yoko-primary text-white shadow-md', 'text-gray-500 hover:bg-gray-50').replace('text-yoko-primary', 'text-gray-400');
            if (el.id.includes('mobile')) el.className = 'flex flex-col items-center p-2 text-gray-400 hover:text-yoko-primary transition-colors flex-1';
        }
    };

    if (tabId === 'orders') {
        setActive(tabOrders, true);
        setActive(tabMenu, false);
        setActive(tabOrdersMobile, true);
        setActive(tabMenuMobile, false);
    } else {
        setActive(tabOrders, false);
        setActive(tabMenu, true);
        setActive(tabOrdersMobile, false);
        setActive(tabMenuMobile, true);
    }

    // Views
    document.getElementById('view-orders').classList.add('hidden');
    document.getElementById('view-menu').classList.add('hidden');

    document.getElementById(`view-${tabId}`).classList.remove('hidden');

    if (tabId === 'orders') fetchOrders();
    if (tabId === 'menu') fetchMenu();
}

function initDashboard() {
    fetchOrders();
    setupRealtime();
}

// --- HELPER: Padded ID ---
function padId(id) {
    return '#' + id.toString().padStart(5, '0');
}

// --- ORDERS SYSTEM ---
async function fetchOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '<div class="text-center py-10 text-gray-400"><i class="fa-solid fa-spinner fa-spin"></i> Actualizando...</div>';

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // Increased limit for better stats

    if (error) {
        console.error('Error fetching orders:', error);
        container.innerHTML = `<div class="text-red-500 text-center">Error al cargar pedidos</div>`;
        return;
    }

    currentOrders = orders;
    calculateStats(orders);
    renderOrders(orders);
}

function calculateStats(orders) {
    // Filter today's orders
    const today = new Date().toDateString();
    const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today);

    // Calculate Revenue
    const revenue = todayOrders.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);

    // Update UI
    document.getElementById('stats-revenue').textContent = `$${revenue.toLocaleString()}`;
    document.getElementById('stats-count').textContent = todayOrders.length;
}

function renderOrders(orders) {
    const container = document.getElementById('orders-list');
    if (orders.length === 0) {
        container.innerHTML = `<div class="text-gray-400 text-center py-10 italic">No hay pedidos recientes</div>`;
        return;
    }

    container.innerHTML = orders.map(order => {
        const date = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Items Preview (First 2 items)
        let items = [];
        try { items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items; } catch (e) { items = []; }
        const itemSummary = items.slice(0, 2).map(i => `${i.title || i.name}`).join(', ') + (items.length > 2 ? ` +${items.length - 2} más` : '');

        // Status Colors
        const statusColors = {
            'pending': 'bg-yellow-100 text-yellow-700',
            'completed': 'bg-green-100 text-green-700',
            'cancelled': 'bg-red-100 text-red-700'
        };
        const statusClass = statusColors[order.status] || 'bg-gray-100 text-gray-600';

        return `
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group" onclick="openModal(${order.id})">
            <div class="flex justify-between items-start mb-3 border-b border-gray-50 pb-3">
                <div>
                    <h3 class="font-bold text-lg text-yoko-dark group-hover:text-yoko-primary transition-colors">${padId(order.id)}</h3>
                    <p class="text-xs text-gray-400 font-mono flex items-center gap-1"><i class="fa-regular fa-clock"></i> ${date}</p>
                </div>
                <div class="text-right">
                    <span class="px-3 py-1 rounded-full text-xs font-bold uppercase ${statusClass}">${order.status === 'pending' ? 'Pendiente' : order.status}</span>
                    <p class="font-bold text-yoko-primary mt-1 text-lg">$${order.total}</p>
                </div>
            </div>

            <!-- Mini Summary -->
            <div class="flex justify-between items-center text-sm text-gray-600">
                <div class="flex items-center gap-2">
                     <i class="fa-solid fa-user text-gray-300"></i>
                     <span class="font-bold truncate max-w-[120px]">${order.customer_name || 'Sin Nombre'}</span>
                </div>
                <div class="text-xs text-gray-400 text-right truncate max-w-[150px]">
                    ${itemSummary}
                </div>
            </div>
             
             <!-- Quick Actions (Only if Pending) -->
             ${order.status === 'pending' ? `
             <div class="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-50" onclick="event.stopPropagation()">
                <button onclick="updateOrderStatus(${order.id}, 'completed')" class="py-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 text-xs font-bold transition-colors">
                    <i class="fa-solid fa-check"></i> Completar
                </button>
                <button onclick="updateOrderStatus(${order.id}, 'cancelled')" class="py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-colors">
                   Cancelar
                </button>
             </div>
             ` : ''}
        </div>
        `;
    }).join('');
}

// --- MODAL LOGIC ---
function openModal(orderId) {
    const order = currentOrders.find(o => o.id === orderId);
    if (!order) return;

    // Populate Fields
    document.getElementById('modal-id').textContent = padId(order.id);
    document.getElementById('modal-date').textContent = new Date(order.created_at).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' });
    document.getElementById('modal-customer').textContent = order.customer_name || 'Sin Nombre';
    document.getElementById('modal-phone').textContent = order.customer_phone || 'Sin Teléfono';
    document.getElementById('modal-address').textContent = order.delivery_address || 'Recoger en Tienda';
    document.getElementById('modal-total').textContent = `$${order.total}`;

    // Populate Items
    let items = [];
    try { items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items; } catch (e) { items = []; }

    document.getElementById('modal-items').innerHTML = items.map(item => {
        // Build customization string if exists
        let details = [];
        if (item.base) details.push(`Base: ${item.base}`);
        if (item.protein) details.push(`Proteínas: ${Array.isArray(item.protein) ? item.protein.join(', ') : item.protein}`);
        // Add more details if relevant structure exists
        const meta = details.length > 0 ? `<p class="text-[10px] text-gray-400 mt-0.5">${details.join(' • ')}</p>` : `<p class="text-[10px] text-gray-400 mt-0.5">${item.description || ''}</p>`;

        return `
        <div class="flex justify-between items-start border-b border-gray-50 pb-2 last:border-0">
            <div>
                <p class="text-sm font-bold text-yoko-dark">1x ${item.title || item.name}</p>
                ${meta}
            </div>
            <p class="text-sm font-bold text-gray-500">$${item.price}</p>
        </div>
        `;
    }).join('');

    // Actions
    const actionsContainer = document.getElementById('modal-actions');
    if (order.status === 'pending') {
        actionsContainer.innerHTML = `
            <button onclick="updateOrderStatus(${order.id}, 'cancelled'); closeModal()" class="px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-50 rounded-lg">Cancelar</button>
            <button onclick="updateOrderStatus(${order.id}, 'completed'); closeModal()" class="px-6 py-2 bg-yoko-primary text-white text-sm font-bold rounded-lg shadow-lg shadow-green-900/10 hover:bg-yoko-secondary">Completar Pedido</button>
        `;
    } else {
        actionsContainer.innerHTML = `<span class="text-xs font-bold text-gray-400 uppercase border border-gray-200 px-3 py-1 rounded-lg">Estado: ${order.status}</span>`;
    }

    // Show
    const modal = document.getElementById('order-modal');
    modal.classList.remove('hidden');
    // Trigger animations
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('order-modal-content').classList.remove('scale-95');
    }, 10);
}

function closeModal() {
    const modal = document.getElementById('order-modal');
    modal.classList.add('opacity-0');
    document.getElementById('order-modal-content').classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}


function setupRealtime() {
    supabase
        .channel('public:orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
            if (payload.eventType === 'INSERT') {
                // Audio
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/933/933-preview.mp3');
                audio.play().catch(e => console.log('Audio user gesture required'));

                // Toast
                const notification = document.createElement('div');
                notification.className = 'fixed top-4 right-4 bg-yoko-primary text-white px-6 py-4 rounded-xl shadow-2xl z-50 animate-bounce cursor-pointer flex items-center gap-3';
                notification.innerHTML = `<i class="fa-solid fa-bell text-yellow-300"></i> <div><p class="font-bold text-sm">¡Nuevo Pedido!</p><p class="text-xs opacity-80">Hace un momento</p></div>`;
                notification.onclick = () => { notification.remove(); fetchOrders(); };
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 8000);
            }
            fetchOrders();
        })
        .subscribe();
}

async function updateOrderStatus(id, status) {
    if (!confirm(`¿Estás seguro de marcar este pedido (#${id}) como ${status}?`)) return;

    const { error } = await supabase
        .from('orders')
        .update({ status: status })
        .eq('id', id);

    if (error) {
        alert('Error al actualizar');
        console.error(error);
    } else {
        fetchOrders(); // UI will update
    }
}


// --- MENU SYSTEM ---
async function fetchMenu() {
    const tableBody = document.getElementById('menu-table-body');
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-10"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</td></tr>';

    // 1. Ingredients
    const { data: ingredients } = await supabase.from('ingredients').select('*').limit(50);
    // 2. Menu Items
    const { data: menuItems } = await supabase.from('menu_items').select('*').limit(50);

    let allItems = [];
    if (ingredients) allItems = [...allItems, ...ingredients.map(i => ({ ...i, type: 'ingred' }))];
    if (menuItems) allItems = [...allItems, ...menuItems.map(i => ({ ...i, type: 'menu' }))];

    tableBody.innerHTML = allItems.map(item => `
        <tr class="group transition-all bg-white md:bg-transparent shadow-sm md:shadow-none rounded-2xl md:rounded-none flex flex-col md:table-row relative overflow-hidden">
            <!-- Mobile Color Strip -->
            <div class="md:hidden absolute top-0 left-0 w-1.5 h-full ${item.is_available ? 'bg-green-500' : 'bg-gray-300'}"></div>
            
            <td class="px-5 py-4 font-bold text-yoko-dark flex items-center gap-3 md:table-cell">
                 <span class="text-2xl md:text-xl opacity-100 md:opacity-50 md:grayscale md:group-hover:grayscale-0 transition-all">${item.icon || '📦'}</span>
                 <div class="flex flex-col md:block">
                    <span>${item.name}</span>
                    <span class="md:hidden text-[10px] text-gray-400 font-normal uppercase tracking-wider">${item.category || item.type}</span>
                 </div>
            </td>
            
            <td class="px-5 py-2 md:py-4 hidden md:table-cell">
                <span class="px-2 py-1 rounded bg-gray-100 text-gray-500 text-xs font-bold uppercase">${item.category || item.type}</span>
            </td>
            
            <td class="px-5 py-1 md:py-4 font-mono text-gray-600 md:table-cell flex justify-between md:justify-start items-center">
                <span class="md:hidden text-xs text-gray-400 font-sans">Precio:</span>
                <span>$${item.price || item.premium_price || 0}</span>
            </td>
            
            <td class="px-5 py-4 text-center md:table-cell absolute top-0 right-0 md:static">
                <button onclick="toggleAvailability('${item.id}', '${item.type}', ${!item.is_available})" 
                    class="w-10 h-6 rounded-full transition-colors relative ${item.is_available ? 'bg-green-500 shadow-green-200' : 'bg-gray-300'} shadow-inner">
                    <span class="absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${item.is_available ? 'translate-x-4' : 'translate-x-0'} shadow-sm"></span>
                </button>
            </td>
            
            <td class="px-5 py-3 md:py-4 text-right md:table-cell border-t md:border-none border-gray-50 bg-gray-50/50 md:bg-transparent">
                <button onclick="editMenuItem('${item.id}', '${item.type}', '${item.name}', ${item.price || item.premium_price || 0})" class="text-sm font-bold text-yoko-primary hover:text-yoko-accent flex items-center gap-2 md:justify-end w-full md:w-auto justify-center">
                    <i class="fa-solid fa-pen"></i> <span class="md:hidden">Editar Detalle</span>
                </button>
            </td>
        </tr>
    `).join('');
}

async function toggleAvailability(id, type, newState) {
    const table = type === 'menu' ? 'menu_items' : 'ingredients';
    const { error } = await supabase
        .from(table)
        .update({ is_available: newState })
        .eq('id', id);

    if (!error) fetchMenu();
}

// --- EDIT MODAL LOGIC ---
let currentEditItem = null;

function editMenuItem(id, type, currentName, currentPrice) {
    currentEditItem = { id, type };

    // UI Setup
    document.getElementById('edit-modal-name').textContent = currentName;
    const input = document.getElementById('edit-modal-input');
    input.value = currentPrice;

    // Show Modal
    const modal = document.getElementById('edit-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('edit-modal-content').classList.remove('scale-95');
        input.focus();
    }, 10);

    // Bind Save
    document.getElementById('edit-modal-save').onclick = savePrice;

    // Bind Enter Key
    input.onkeyup = (e) => { if (e.key === 'Enter') savePrice(); };
}

async function savePrice() {
    if (!currentEditItem) return;

    const input = document.getElementById('edit-modal-input');
    const newPrice = parseFloat(input.value);

    // Validation
    if (isNaN(newPrice) || newPrice < 0) {
        input.classList.add('border-red-500');
        return;
    }

    const startBtnText = document.getElementById('edit-modal-save').innerText;
    document.getElementById('edit-modal-save').innerText = '...';

    const table = currentEditItem.type === 'menu' ? 'menu_items' : 'ingredients';
    const priceField = currentEditItem.type === 'menu' ? 'price' : 'premium_price';

    const { error } = await supabase
        .from(table)
        .update({ [priceField]: newPrice })
        .eq('id', currentEditItem.id);

    if (error) {
        alert('Error al guardar');
    } else {
        closeEditModal();
        fetchMenu();
    }
    document.getElementById('edit-modal-save').innerText = startBtnText;
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    modal.classList.add('opacity-0');
    document.getElementById('edit-modal-content').classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
        currentEditItem = null;
    }, 300);
}

// Export functions
// --- SIZES / CONFIG LOGIC ---
let currentSizes = [];
let editingSizeId = null;

async function fetchSizes() {
    const container = document.getElementById('sizes-grid');
    if (!container) return; // Guard clause if calling from unknown context

    container.innerHTML = '<div class="text-center py-10 col-span-full text-gray-400"><i class="fa-solid fa-spinner fa-spin"></i> Cargando reglas...</div>';

    const { data: sizes, error } = await supabase
        .from('sizes')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        container.innerHTML = '<div class="text-red-500 col-span-full">Error al cargar reglas</div>';
        return;
    }

    currentSizes = sizes;
    renderSizes(sizes);
}

function renderSizes(sizes) {
    const container = document.getElementById('sizes-grid');
    container.innerHTML = sizes.map(size => {
        return `
        <div class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div class="bg-yoko-light absolute top-0 right-0 p-4 rounded-bl-3xl">
                <i class="fa-solid fa-bowl-food text-yoko-secondary/20 text-4xl transform rotate-12"></i>
            </div>
            
            <h3 class="font-bold text-2xl text-yoko-dark font-serif mb-1">${size.name}</h3>
            <p class="text-3xl font-bold text-yoko-primary mb-6">$${size.base_price}</p>
            
            <!-- Limits Display -->
            <div class="space-y-3 mb-8">
                <div class="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                    <span class="flex items-center gap-2 text-gray-600"><i class="fa-solid fa-fish w-5 text-center text-yoko-accent"></i> Proteínas</span>
                    <div class="text-right">
                        <span class="font-bold text-yoko-dark block">${size.included_proteins} Incluidas</span>
                        <span class="text-xs text-gray-400">Extra: +$${size.price_extra_protein}</span>
                    </div>
                </div>
                 <div class="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                    <span class="flex items-center gap-2 text-gray-600"><i class="fa-solid fa-carrot w-5 text-center text-orange-400"></i> Toppings</span>
                    <div class="text-right">
                        <span class="font-bold text-yoko-dark block">${size.included_toppings} Incluidos</span>
                         <span class="text-xs text-gray-400">Extra: +$${size.price_extra_topping}</span>
                    </div>
                </div>
                 <div class="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                    <span class="flex items-center gap-2 text-gray-600"><i class="fa-solid fa-cookie w-5 text-center text-yellow-600"></i> Crunch</span>
                    <div class="text-right">
                        <span class="font-bold text-yoko-dark block">${size.included_crunches} Incluidos</span>
                         <span class="text-xs text-gray-400">Extra: +$${size.price_extra_crunch}</span>
                    </div>
                </div>
                 <div class="flex justify-between items-center text-sm">
                    <span class="flex items-center gap-2 text-gray-600"><i class="fa-solid fa-bottle-droplet w-5 text-center text-red-400"></i> Salsas</span>
                    <div class="text-right">
                        <span class="font-bold text-yoko-dark block">${size.included_sauces} Incluidas</span>
                         <span class="text-xs text-gray-400">Extra: +$${size.price_extra_sauce}</span>
                    </div>
                </div>
            </div>
            
            <button onclick="openSizeModal(${size.id})" class="w-full py-3 rounded-xl border border-yoko-primary text-yoko-primary font-bold hover:bg-yoko-primary hover:text-white transition-all">
                <i class="fa-solid fa-sliders mr-2"></i> Editar Reglas
            </button>
        </div>
        `;
    }).join('');
}

// --- CONFIG MODAL LOGIC ---
function openSizeModal(id) {
    const size = currentSizes.find(s => s.id === id);
    if (!size) return;

    editingSizeId = id;

    // Fill Form
    document.getElementById('size-modal-name').textContent = size.name;
    const form = document.getElementById('size-form');

    form.base_price.value = size.base_price;
    form.included_proteins.value = size.included_proteins;
    form.price_extra_protein.value = size.price_extra_protein;
    form.included_toppings.value = size.included_toppings;
    form.price_extra_topping.value = size.price_extra_topping;
    form.included_crunches.value = size.included_crunches;
    form.price_extra_crunch.value = size.price_extra_crunch;
    form.included_sauces.value = size.included_sauces;
    form.price_extra_sauce.value = size.price_extra_sauce;

    // Show
    const modal = document.getElementById('size-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('size-modal-content').classList.remove('scale-95');
    }, 10);
}

function closeSizeModal() {
    const modal = document.getElementById('size-modal');
    modal.classList.add('opacity-0');
    document.getElementById('size-modal-content').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        editingSizeId = null;
    }, 300);
}

async function saveSizeRules() {
    if (!editingSizeId) return;

    const btn = document.getElementById('size-btn-save');
    const originalText = btn.innerText;
    btn.innerText = 'Guardando...';

    const form = document.getElementById('size-form');
    // Gather values
    const updates = {
        base_price: parseFloat(form.base_price.value) || 0,
        included_proteins: parseInt(form.included_proteins.value) || 0,
        price_extra_protein: parseFloat(form.price_extra_protein.value) || 0,
        included_toppings: parseInt(form.included_toppings.value) || 0,
        price_extra_topping: parseFloat(form.price_extra_topping.value) || 0,
        included_crunches: parseInt(form.included_crunches.value) || 0,
        price_extra_crunch: parseFloat(form.price_extra_crunch.value) || 0,
        included_sauces: parseInt(form.included_sauces.value) || 0,
        price_extra_sauce: parseFloat(form.price_extra_sauce.value) || 0
    };

    const { error } = await supabase
        .from('sizes')
        .update(updates)
        .eq('id', editingSizeId);

    if (error) {
        alert('Error al guardar reglas');
        console.error(error);
    } else {
        closeSizeModal();
        fetchSizes();
    }
    btn.innerText = originalText;
}

// Modify switchTab to handle 'config'
const originalSwitchTab = window.switchTab;
window.switchTab = function (tabId) {
    if (originalSwitchTab) originalSwitchTab(tabId);

    const tabConfig = document.getElementById('tab-config-desktop');
    const tabConfigMobile = document.getElementById('tab-config-mobile');
    const viewConfig = document.getElementById('view-config');

    // Reset styles manually since original might not know about config
    // Actually, simpler to just override the logic or hook into it.
    // Let's copy-paste logical extension or better, replace the function entirely if needed.
    // Given tool limitation, I am declaring it again which overrides.

    // Buttons Desktop
    const tabOrders = document.getElementById('tab-orders-desktop');
    const tabMenu = document.getElementById('tab-menu-desktop');

    // Buttons Mobile
    const tabOrdersMobile = document.getElementById('tab-orders-mobile');
    const tabMenuMobile = document.getElementById('tab-menu-mobile');

    // Helper
    const setActive = (el, active) => {
        if (!el) return;
        if (active) {
            el.className = el.className.replace('text-gray-500 hover:bg-gray-50', 'bg-yoko-primary text-white shadow-md').replace('text-gray-400', 'text-yoko-primary');
            if (el.id.includes('mobile')) el.className = 'flex flex-col items-center p-2 text-yoko-primary transition-colors flex-1';
        } else {
            el.className = el.className.replace('bg-yoko-primary text-white shadow-md', 'text-gray-500 hover:bg-gray-50').replace('text-yoko-primary', 'text-gray-400');
            if (el.id.includes('mobile')) el.className = 'flex flex-col items-center p-2 text-gray-400 hover:text-yoko-primary transition-colors flex-1';
        }
    };

    // Reset All
    setActive(tabOrders, false);
    setActive(tabMenu, false);
    setActive(tabConfig, false);
    setActive(tabOrdersMobile, false);
    setActive(tabMenuMobile, false);
    setActive(tabConfigMobile, false);

    document.getElementById('view-orders').classList.add('hidden');
    document.getElementById('view-menu').classList.add('hidden');
    document.getElementById('view-config').classList.add('hidden');

    // Activate Current
    if (tabId === 'orders') {
        setActive(tabOrders, true);
        setActive(tabOrdersMobile, true);
        document.getElementById('view-orders').classList.remove('hidden');
        fetchOrders();
    } else if (tabId === 'menu') {
        setActive(tabMenu, true);
        setActive(tabMenuMobile, true);
        document.getElementById('view-menu').classList.remove('hidden');
        fetchMenu();
    } else if (tabId === 'config') {
        setActive(tabConfig, true);
        setActive(tabConfigMobile, true);
        document.getElementById('view-config').classList.remove('hidden');
        fetchSizes();
    }
}

// Exports
// --- PRODUCT CREATION LOGIC ---
function openProductModal() {
    // Reset Form
    const form = document.getElementById('product-form');
    form.reset();
    toggleProductFields(); // Reset visibility

    // Show
    const modal = document.getElementById('product-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('product-modal-content').classList.remove('scale-95');
    }, 10);
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    modal.classList.add('opacity-0');
    document.getElementById('product-modal-content').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function toggleProductFields() {
    const type = document.querySelector('input[name="table_type"]:checked').value;
    const fieldIngred = document.getElementById('field-ingred-type');
    const fieldMenu = document.getElementById('field-menu-cat');

    if (type === 'ingredients') {
        fieldIngred.classList.remove('hidden');
        fieldMenu.classList.add('hidden');
    } else {
        fieldIngred.classList.add('hidden');
        fieldMenu.classList.remove('hidden');
    }
}

async function saveProduct() {
    const btn = document.getElementById('prod-btn-save');
    const originalText = btn.innerText;
    btn.innerText = 'Guardando...';

    const form = document.getElementById('product-form');
    const table = form.table_type.value; // 'ingredients' or 'menu_items'

    const name = form.name.value;
    const price = parseFloat(form.price.value) || 0;
    const icon = form.icon.value || '📦';

    let payload = {
        name: name,
        is_available: true
    };

    if (table === 'ingredients') {
        payload.type = form.ingred_type.value;
        payload.premium_price = price;
        payload.icon = icon;
        // is_premium is true if price > 0 usually, but simplify:
        payload.is_premium = price > 0;
    } else {
        payload.category = form.menu_category.value;
        payload.price = price;
        // menu_items doesn't strictly need icon column in current schema but we can try adding description if needed
    }

    const { error } = await supabase
        .from(table)
        .insert([payload]);

    if (error) {
        alert('Error al crear producto');
        console.error(error);
    } else {
        closeProductModal();
        fetchMenu();
        // Switch to menu tab if not there
        switchTab('menu');
    }
    btn.innerText = originalText;
}

// Exports
window.openSizeModal = openSizeModal;
window.closeSizeModal = closeSizeModal;
window.saveSizeRules = saveSizeRules;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.toggleProductFields = toggleProductFields;
window.saveProduct = saveProduct;
