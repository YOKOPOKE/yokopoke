
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xsolxbroqqjkoseksmny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzb2x4YnJvcXFqa29zZWtzbW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTQ2MTksImV4cCI6MjA4MzE5MDYxOX0.sGIq7yEoEw5Sw1KKHhRQOEJGX2HjEDcOelO49IVhndk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategories() {
    console.log("Checking Ingredients Categories...");
    const { data: ingredients, error } = await supabase
        .from('ingredients')
        .select('*')
        .limit(200);

    if (error) {
        console.error("Error fetching ingredients:", error);
        return;
    }

    // Get unique types
    const types = [...new Set(ingredients.map(i => i.type || i.category))];
    console.log("Found Types/Categories in DB:", types);

    // Group by type to see counts
    const breakdown = ingredients.reduce((acc, i) => {
        const t = i.type || i.category || 'undefined';
        acc[t] = (acc[t] || 0) + 1;
        return acc;
    }, {});
    console.log("Counts per category:", breakdown);

    // Sample items for each type
    types.forEach(t => {
        const sample = ingredients.find(i => (i.type || i.category) === t);
        console.log(`- ${t}: e.g. "${sample.name}"`);
    });
}

checkCategories();
