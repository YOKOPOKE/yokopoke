const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkImages() {
    const { data: menuItems, error } = await supabase
        .from('menu_items')
        .select('id, name, image_url, category')
        .order('id', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching items:', error);
    } else {
        console.log('Latest 5 Menu Items:');
        menuItems.forEach(item => {
            console.log(`[${item.id}] ${item.name} (${item.category})`);
            console.log(`    Image: ${item.image_url || 'NULL'}`);
        });
    }

    const { data: ingredients, error: ingredError } = await supabase
        .from('ingredients')
        .select('id, name, image_url, type')
        .order('id', { ascending: false })
        .limit(5);

    if (ingredError) {
        console.error('Error fetching ingredients:', ingredError);
    } else {
        console.log('\nLatest 5 Ingredients:');
        ingredients.forEach(item => {
            console.log(`[${item.id}] ${item.name} (${item.type})`);
            console.log(`    Image: ${item.image_url || 'NULL'}`);
        });
    }
}

checkImages();
