-- Cambio formal aprobado: UT global o individual. NULL conserva el respaldo global histórico.
BEGIN;
ALTER TABLE metro ADD COLUMN IF NOT EXISTS duracion_ut INTEGER;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='metro'::regclass AND conname='chk_metro_duracion_ut') THEN
    ALTER TABLE metro ADD CONSTRAINT chk_metro_duracion_ut CHECK (duracion_ut IS NULL OR duracion_ut > 0);
  END IF;
END $$;
COMMIT;
