
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Hardcoded for debugging to rule out .env loading issues
const supabaseUrl = 'https://xsolxbroqqjkoseksmny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzb2x4YnJvcXFqa29zZWtzbW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTQ2MTksImV4cCI6MjA4MzE5MDYxOX0.sGIq7yEoEw5Sw1KKHhRQOEJGX2HjEDcOelO49IVhndk';

export const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

export const createClient = () => supabase;

console.log('Supabase Client Initialized with URL:', supabaseUrl);
