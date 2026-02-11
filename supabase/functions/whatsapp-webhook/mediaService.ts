
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");

// Helper to download media from WhatsApp
export async function downloadMedia(mediaId: string): Promise<{ mimeType: string; data: string } | null> {
    try {
        if (!WHATSAPP_ACCESS_TOKEN) throw new Error("Missing WA Token");

        // 1. Get Media URL
        const urlResponse = await fetch(
            `https://graph.facebook.com/v21.0/${mediaId}`,
            {
                headers: { "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}` }
            }
        );

        if (!urlResponse.ok) {
            console.error("Failed to get media URL:", await urlResponse.text());
            return null;
        }

        const urlData = await urlResponse.json();
        const mediaUrl = urlData.url;
        const mimeType = urlData.mime_type;

        console.log(`📥 Downloading media: ${mediaId} (${mimeType}) from ${mediaUrl}`);

        // 2. Download Binary
        const binaryResponse = await fetch(mediaUrl, {
            headers: { "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}` }
        });

        if (!binaryResponse.ok) {
            console.error("Failed to download media binary:", await binaryResponse.text());
            return null;
        }

        const arrayBuffer = await binaryResponse.arrayBuffer();

        // 3. Convert to Base64
        // Deno specific Base64 encoding
        const uint8Array = new Uint8Array(arrayBuffer);

        // Simple manual conversion to avoid large dependency import issues in Edge
        // Or use btoa() on string? btoa() works on binary strings.
        let binaryString = "";
        for (let i = 0; i < uint8Array.byteLength; i++) {
            binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binaryString);

        return { mimeType, data: base64Data };

    } catch (e) {
        console.error("Media Download Error:", e);
        return null;
    }
}
