-- Update Step Options with Emojis for "Poke" and "Burger" ingredients

-- BASES
UPDATE step_options SET name = '🍚 ' || name WHERE name = 'Arroz Blanco';
UPDATE step_options SET name = '🍙 ' || name WHERE name = 'Arroz Negro'; -- or 🍘
UPDATE step_options SET name = '🥬 ' || name WHERE name = 'Noodles de Vegetal';
UPDATE step_options SET name = '🥗 ' || name WHERE name = 'Lechuga (Mix)';

-- PROTEINS
UPDATE step_options SET name = '🐟 ' || name WHERE name = 'Atún Fresco';
UPDATE step_options SET name = '🌶️🐟 ' || name WHERE name = 'Spicy Tuna';
UPDATE step_options SET name = '🥩 ' || name WHERE name = 'Arrachera';
UPDATE step_options SET name = '🍗 ' || name WHERE name = 'Pollo al Grill';
UPDATE step_options SET name = '🥘 ' || name WHERE name = 'Pollo Teriyaki';
UPDATE step_options SET name = '🍯🐟 ' || name WHERE name = 'Sweet Salmon';
UPDATE step_options SET name = '🦀 ' || name WHERE name = 'Kanikama';
UPDATE step_options SET name = '🍔 ' || name WHERE name = 'Res';
UPDATE step_options SET name = '🍤 ' || name WHERE name = 'Camarón';
UPDATE step_options SET name = '🍗 ' || name WHERE name = 'Pollo Empanizado';
UPDATE step_options SET name = '🦀 ' || name WHERE name = 'Surimi';
UPDATE step_options SET name = '🥩🍤 ' || name WHERE name = 'Mixta (Res + Camarón)';

-- TOPPINGS
UPDATE step_options SET name = '🥒 ' || name WHERE name = 'Pepino';
UPDATE step_options SET name = '🥑 ' || name WHERE name = 'Aguacate';
UPDATE step_options SET name = '🥭 ' || name WHERE name = 'Mango';
UPDATE step_options SET name = '🥕 ' || name WHERE name = 'Zanahoria';
UPDATE step_options SET name = '🌽 ' || name WHERE name = 'Elotes';
UPDATE step_options SET name = '🫑 ' || name WHERE name = 'Pimiento';
UPDATE step_options SET name = '🫛 ' || name WHERE name = 'Edamames';
UPDATE step_options SET name = '🍅 ' || name WHERE name = 'Tomate Cherry';
UPDATE step_options SET name = '🧀 ' || name WHERE name = 'Queso Philadelphia';
UPDATE step_options SET name = '🧀 ' || name WHERE name = 'Queso Extra';
UPDATE step_options SET name = '🥑 ' || name WHERE name = 'Aguacate Extra';

-- CRUNCH
UPDATE step_options SET name = '🥜 ' || name WHERE name = 'Almendra Fileteada';
UPDATE step_options SET name = '🥟 ' || name WHERE name = 'Won Ton';
UPDATE step_options SET name = '🥜 ' || name WHERE name = 'Cacahuate Garapiñado';
UPDATE step_options SET name = '🥜 ' || name WHERE name = 'Cacahuate';
UPDATE step_options SET name = '🍌 ' || name WHERE name = 'Banana Chips';
UPDATE step_options SET name = '🥓 ' || name WHERE name = 'Betabel Bacon';
UPDATE step_options SET name = '🌽 ' || name WHERE name = 'Maicito Enchilado';
UPDATE step_options SET name = '🌽 ' || name WHERE name = 'Maicito';

-- SALSAS
UPDATE step_options SET name = '🥢 ' || name WHERE name = 'Soya';
UPDATE step_options SET name = '🌶️ ' || name WHERE name = 'Siracha';
UPDATE step_options SET name = '🍋 ' || name WHERE name = 'Ponzu';
UPDATE step_options SET name = '🥭🌶️ ' || name WHERE name = 'Mango Habanero';
UPDATE step_options SET name = '🧄 ' || name WHERE name = 'Mayo Ajo';
UPDATE step_options SET name = '🌿 ' || name WHERE name = 'Mayo Cilantro';
UPDATE step_options SET name = '🍱 ' || name WHERE name = 'Anguila'; -- or 🍘
UPDATE step_options SET name = '🍱 ' || name WHERE name = 'Salsa Anguila';
UPDATE step_options SET name = '🫒 ' || name WHERE name = 'Olive Oil';
UPDATE step_options SET name = '💧 ' || name WHERE name = 'Habanero Drops';
UPDATE step_options SET name = '🍯 ' || name WHERE name = 'Agridulce';
UPDATE step_options SET name = '🌶️ ' || name WHERE name = 'Salsa Chipotle';
