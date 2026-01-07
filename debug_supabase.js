
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xsolxbroqqjkoseksmny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzb2x4YnJvcXFqa29zZWtzbW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTQ2MTksImV4cCI6MjA4MzE5MDYxOX0.sGIq7yEoEw5Sw1KKHhRQOEJGX2HjEDcOelO49IVhndk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log("Fetching ingredients...");
    const { data, error } = await supabase.from('ingredients').select('*');
    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${data.length} items`);
        const categories = {};
        data.forEach(item => {
            const cat = item.category;
            if (!categories[cat]) categories[cat] = 0;
            categories[cat]++;
        });
        console.log("Categories found:", categories);
        if (data.length > 0) {
            console.log("Sample item:", data[0]);
        }
    }
}

debug();
