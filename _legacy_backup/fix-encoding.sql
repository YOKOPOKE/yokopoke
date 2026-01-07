-- FIX UTF-8 ENCODING ISSUES IN DATABASE
-- Run this in Supabase SQL Editor to fix corrupted emojis and text

-- Fix ingredients table emojis
UPDATE ingredients 
SET icon = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    icon,
    'δŸ¥¢', '🥢'),
    'δŸ¢', '🍢'),
    'δŸ¥—', '🥗'),
    'δŸŸ', '🍟'),
    'δŸ¥¤', '🥤'),
    'δŸ§', '🍧')
WHERE icon LIKE '%δ%' OR icon LIKE '%Ÿ%';

-- Fix ingredient names with corrupted characters
UPDATE ingredients 
SET name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    name,
    'Ã¡', 'á'),
    'Ã©', 'é'),
    'Ã­', 'í'),
    'Ã³', 'ó'),
    'Ãº', 'ú'),
    'Ã±', 'ñ')
WHERE name LIKE '%Ã%';

-- Fix menu_items table (this one has description)
UPDATE menu_items 
SET description = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    description,
    'Ã¡', 'á'),
    'Ã©', 'é'),
    'Ã­', 'í'),
    'Ã³', 'ó'),
    'Ãº', 'ú'),
    'Ã±', 'ñ')
WHERE description LIKE '%Ã%';

UPDATE menu_items 
SET name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    name,
    'Ã¡', 'á'),
    'Ã©', 'é'),
    'Ã­', 'í'),
    'Ã³', 'ó'),
    'Ãº', 'ú'),
    'Ã±', 'ñ')
WHERE name LIKE '%Ã%';

-- Verify the fixes
SELECT 'Ingredients' as table_name, id, name, icon 
FROM ingredients 
ORDER BY type, name;

SELECT 'Menu Items' as table_name, id, name, description
FROM menu_items 
ORDER BY category, name;
