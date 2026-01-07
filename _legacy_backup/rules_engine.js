
// --- RULES ENGINE (INJECTED) ---
let rulesEngineData = [];
// We assume supabase client is available globally or we import it.
// script.js likely exposes 'supabase' or we need to import it.
// We'll try to import from the standard path.
import { supabase } from './supabaseClient.js';

async function initRules() {
    console.log('🥑 Initializing Rules Engine...');
    try {
        const { data, error } = await supabase.from('ingredient_rules').select('*');
        if (error) throw error;

        rulesEngineData = data || [];
        console.log('Reglas cargadas:', rulesEngineData.length);

        // Start Observer
        startRulesObserver();
    } catch (e) {
        console.warn('Could not load rules:', e);
    }
}

function startRulesObserver() {
    // 1. Observer for dynamic content injection
    const observer = new MutationObserver(() => {
        validateRules();
    });

    // Observer wizard steps
    const wizard = document.getElementById('product-wizard') || document.body;
    observer.observe(wizard, { childList: true, subtree: true });

    // 2. Global Click Listener for selection changes
    document.addEventListener('click', (e) => {
        // Run validation on any click (debounced slightly or just run)
        setTimeout(validateRules, 50);
    });
}

function validateRules() {
    if (rulesEngineData.length === 0) return;

    // 1. Identify Selected Items
    // We look for elements that look selected (green background, ring, etc)
    const selectedSelector = '.ring-2, .bg-yoko-primary.text-white, .btn-selected';
    const selectedEls = document.querySelectorAll(selectedSelector);
    const selectedIds = Array.from(selectedEls).map(el => el.getAttribute('data-id') || el.dataset.id).filter(Boolean);

    // 2. Reset Disables
    document.querySelectorAll('.rule-disabled').forEach(el => {
        el.classList.remove('rule-disabled', 'opacity-50', 'pointer-events-none', 'grayscale', 'cursor-not-allowed');
        el.title = '';
    });

    // 3. Apply Rules
    rulesEngineData.forEach(rule => {
        if (selectedIds.includes(rule.trigger_id.toString())) {

            // Find Target Element (Button/Card)
            const targetEls = document.querySelectorAll(`[data-id="${rule.target_id}"]`);

            targetEls.forEach(targetEl => {
                // If Rule matches
                if (rule.action === 'ban') {
                    targetEl.classList.add('rule-disabled', 'opacity-50', 'pointer-events-none', 'grayscale', 'cursor-not-allowed');
                    targetEl.title = rule.message || 'No disponible con tu selección actual';

                    // If it was selected, warn in console (forcing deselect is tricky without triggering loops)
                    if (targetEl.matches(selectedSelector)) {
                        console.warn('Conflict detected:', rule.message);
                    }
                }
            });
        }
    });
}

// Boot
initRules();
