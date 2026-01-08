import os

file_path = '.env.local'

try:
    if os.path.exists(file_path):
        # Read as binary to capture all bytes
        with open(file_path, 'rb') as f:
            content = f.read()
        
        # Remove null bytes
        clean_content = content.replace(b'\x00', b'')
        
        # Decode trying utf-8, fallback to latin-1 if needed, correcting CRLF
        text = clean_content.decode('utf-8', errors='ignore').replace('\r\n', '\n')
        
        # Write back as pure UTF-8
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(text)
            
        print("✅ .env.local cleaned successfully (Python).")
    else:
        print("⚠️ File not found.")

except Exception as e:
    print(f"❌ Error: {e}")
