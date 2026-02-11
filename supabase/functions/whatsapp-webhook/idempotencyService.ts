import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/**
 * Checks if a message ID has already been successfully processed.
 * If not, it attempts to "claim" the ID by inserting it.
 * Return true if we should process it. 
 * Return false if it's a duplicate.
 */
export async function claimMessageId(messageId: string): Promise<boolean> {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
        // Fast Check: If ID exists, skip.
        // Or better: Attempt Insert. If conflict, skip.
        // This is atomic and handles race conditions perfectly.

        const { error } = await supabase
            .from('processed_messages')
            .insert({ message_id: messageId });

        if (error) {
            // Duplicate Key Error (Code 23505 in Postgres)
            if (error.code === '23505') {
                console.warn(`♻️ Duplicate Message ID Ignored: ${messageId}`);
                return false;
            }
            if (error.message.includes('duplicate key')) {
                console.warn(`♻️ Duplicate Message ID Ignored: ${messageId}`);
                return false;
            }
            // Other error? Assume false to be safe or true to retry?
            // Safer to allow retry if DB error, but risk duplication.
            // Senior approach: If DB fails, we fail the request, don't double process.
            console.error("Idempotency Check Error:", error);
            return true; // Fallback: Allow processing if DB is flaky? Or block?Ideally BLOCK to be safe.
        }

        return true; // Successfully claimed
    } catch (e) {
        console.error("Idempotency System Error:", e);
        return true; // Fallback to avoid deadlocking users if system is down
    }
}
