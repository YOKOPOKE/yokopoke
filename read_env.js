
const fs = require('fs');
try {
    const content = fs.readFileSync('_legacy_backup/.env', 'utf8');
    console.log(JSON.stringify(content));
} catch (e) {
    console.error(e);
}
