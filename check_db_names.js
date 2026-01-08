const { createClient } = require('@supabase/supabase-js');

// Using the key found in debug_supabase.js
const supabaseUrl = 'https://xsolxbroqqjkoseksmny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzb2x4YnJvcXFqa29zZWtzbW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTQ2MTksImV4cCI6MjA4MzE5MDYxOX0.sGIq7yEoEw5Sw1KKHhRQOEJGX2HjEDcOelO49IVhndk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNames() {
    console.log("Checking current names in DB...");

    // Fetch a sample of names
    const { data, error } = await supabase
        .from('step_options')
        .select('name')
        .limit(20);

    if (error) {
        console.error("Error fetching names:", error);
    } else {
        console.log("Current names in DB:");
        data.forEach(d => console.log(`- "${d.name}"`));
    }
}

checkNames();
