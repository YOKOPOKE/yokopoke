
const { createClient } = require('@supabase/supabase-js');

// Hardcoded for debugging
const supabaseUrl = 'https://xsolxbroqqjkoseksmny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzb2x4YnJvcXFqa29zZWtzbW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTQ2MTksImV4cCI6MjA4MzE5MDYxOX0.sGIq7yEoEw5Sw1KKHhRQOEJGX2HjEDcOelO49IVhndk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log("Fetching types...");
    const { data, error } = await supabase.from('ingredients').select('type, name');
    if (error) {
        console.error("Error:", error);
    } else {
        const types = {};
        data.forEach(item => {
            const t = item.type || 'unknown';
            if (!types[t]) types[t] = [];
            types[t].push(item.name);
        });
        console.log("Grouped by TYPE:", JSON.stringify(types, null, 2));
    }
}

debug();
