const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');

try {
    let content = fs.readFileSync(envPath);

    // Convert buffer to string, filtering out null bytes usually associated with UTF-16LE interpreted as UTF-8
    // or just mixed encoding artifacts.
    let stringContent = content.toString('utf8').replace(/\0/g, '');

    // Normalize newlines
    stringContent = stringContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    fs.writeFileSync(envPath, stringContent, { encoding: 'utf8' });
    console.log('✅ .env.local encoding fixed/cleaned successfully.');
} catch (error) {
    console.error('❌ Error fixing .env.local:', error);
}
