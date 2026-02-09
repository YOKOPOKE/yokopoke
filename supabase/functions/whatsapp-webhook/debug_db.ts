
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

console.log("--- CATEGORIES ---");
const { data: categories, error: catError } = await supabase.from('categories').select('*');
if (catError) console.error(catError);
else console.table(categories);

console.log("\n--- PRODUCTS (Active) ---");
const { data: products, error: prodError } = await supabase.from('products').select('id, name, category_id, is_active, slug').eq('is_active', true);
if (prodError) console.error(prodError);
else console.table(products);
