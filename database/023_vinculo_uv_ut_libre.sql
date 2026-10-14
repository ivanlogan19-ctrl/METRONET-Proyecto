-- Cambio formal aprobado: vínculo automático exclusivamente en Modo Libre.
BEGIN;
ALTER TABLE metro ALTER COLUMN duracion_ut TYPE NUMERIC(18,8) USING duracion_ut::numeric;
ALTER TABLE metro ALTER COLUMN velocidad_promedio TYPE NUMERIC(18,8) USING velocidad_promedio::numeric;
ALTER TABLE simulacion ALTER COLUMN duracion TYPE NUMERIC(18,8) USING duracion::numeric;
ALTER TABLE metro ADD COLUMN IF NOT EXISTS referencia_uv_ut VARCHAR(2) NOT NULL DEFAULT 'UV';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='metro'::regclass AND conname='chk_metro_referencia_uv_ut') THEN
  ALTER TABLE metro ADD CONSTRAINT chk_metro_referencia_uv_ut CHECK (referencia_uv_ut IN ('UV','UT'));
 END IF;
END $$;
COMMIT;
