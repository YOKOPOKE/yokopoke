const { createClient } = require('@supabase/supabase-js');

// Using the key found in debug_supabase.js
const supabaseUrl = 'https://xsolxbroqqjkoseksmny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzb2x4YnJvcXFqa29zZWtzbW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTQ2MTksImV4cCI6MjA4MzE5MDYxOX0.sGIq7yEoEw5Sw1KKHhRQOEJGX2HjEDcOelO49IVhndk';

const supabase = createClient(supabaseUrl, supabaseKey);

const EMOJI_MAP = {
    // Bases
    'Arroz Blanco': '🍚 Arroz Blanco',
    'Arroz Negro': '🍘 Arroz Negro',
    'Noodles de Vegetal': '🥬 Noodles de Vegetal',
    'Lechuga (Mix)': '🥗 Lechuga (Mix)',

    // Proteins
    'Atún Fresco': '🐟 Atún Fresco',
    'Spicy Tuna': '🌶️🐟 Spicy Tuna',
    'Arrachera': '🥩 Arrachera',
    'Pollo al Grill': '🍗 Pollo al Grill',
    'Pollo Teriyaki': '🥘 Pollo Teriyaki',
    'Sweet Salmon': '🍯🐟 Sweet Salmon',
    'Kanikama': '🦀 Kanikama',
    'Res': '🍔 Res',
    'Camarón': '🍤 Camarón',
    'Pollo Empanizado': '🍗 Pollo Empanizado',
    'Surimi': '🦀 Surimi',
    'Mixta (Res + Camarón)': '🥩🍤 Mixta (Res + Camarón)',

    // Toppings
    'Pepino': '🥒 Pepino',
    'Aguacate': '🥑 Aguacate',
    'Mango': '🥭 Mango',
    'Zanahoria': '🥕 Zanahoria',
    'Elotes': '🌽 Elotes',
    'Pimiento': '🫑 Pimiento',
    'Edamames': '🫛 Edamames',
    'Tomate Cherry': '🍅 Tomate Cherry',
    'Queso Philadelphia': '🧀 Queso Philadelphia',
    'Queso Extra': '🧀 Queso Extra',
    'Aguacate Extra': '🥑 Aguacate Extra',

    // Crunch
    'Almendra Fileteada': '🥜 Almendra Fileteada',
    'Won Ton': '🥟 Won Ton',
    'Cacahuate Garapiñado': '🥜 Cacahuate Garapiñado',
    'Cacahuate': '🥜 Cacahuate',
    'Banana Chips': '🍌 Banana Chips',
    'Betabel Bacon': '🥓 Betabel Bacon',
    'Maicito Enchilado': '🌽 Maicito Enchilado',
    'Maicito': '🌽 Maicito',

    // Salsas
    'Soya': '🥢 Soya',
    'Siracha': '🌶️ Siracha',
    'Ponzu': '🍋 Ponzu',
    'Mango Habanero': '🥭🌶️ Mango Habanero',
    'Mayo Ajo': '🧄 Mayo Ajo',
    'Mayo Cilantro': '🌿 Mayo Cilantro',
    'Anguila': '🍱 Anguila',
    'Salsa Anguila': '🍱 Salsa Anguila',
    'Olive Oil': '🫒 Olive Oil',
    'Habanero Drops': '💧 Habanero Drops',
    'Agridulce': '🍯 Agridulce',
    'Salsa Chipotle': '🌶️ Salsa Chipotle'
};

async function updateEmojis() {
    console.log("Starting Emoji Update...");
    let successCount = 0;

    for (const [originalName, newName] of Object.entries(EMOJI_MAP)) {
        // Only update if it doesn't already have the emoji (simple check)
        // Or just blindly update where name = originalName
        const { error } = await supabase
            .from('step_options')
            .update({ name: newName })
            .eq('name', originalName);

        if (error) {
            console.error(`Failed to update ${originalName}:`, error.message);
        } else {
            // console.log(`Updated: ${originalName} -> ${newName}`);
            successCount++;
        }
    }

    console.log(`Finished! Updated potential ${successCount} items.`);
}

updateEmojis();
