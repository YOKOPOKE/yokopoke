
const fs = require('fs');
try {
    const content = fs.readFileSync('_legacy_backup/.env', 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach(line => {
        if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
            const key = line.replace('VITE_SUPABASE_ANON_KEY=', '');
            console.log("KEY_START");
            for (let i = 0; i < key.length; i += 50) {
                console.log(key.substring(i, i + 50));
            }
            console.log("KEY_END");
        }
    });
} catch (e) {
    console.error(e);
}
