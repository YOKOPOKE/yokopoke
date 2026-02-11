import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export async function getAppConfig(key: string): Promise<any> {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
        const { data, error } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', key)
            .single();

        if (error || !data) return null;
        return data.value;
    } catch (e) {
        console.error(`Config Error (${key}):`, e);
        return null;
    }
}

export async function isMaintenanceMode(): Promise<boolean> {
    const val = await getAppConfig('maintenance_mode');
    return val === true || val === 'true';
}
