-- Add Business Hours current configuration
INSERT INTO app_config (key, value, description)
VALUES ('business_hours', '{"open": 14, "close": 22}'::jsonb, 'Horario de operación (Hora CDMX). open=hora apertura (0-23), close=hora cierre.')
ON CONFLICT (key) DO NOTHING;
