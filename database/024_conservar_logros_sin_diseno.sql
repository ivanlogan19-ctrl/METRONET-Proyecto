-- Cambio formal aprobado: borrar la red de un nivel completado conserva su historial.
-- El servicio separa el intento completado antes del DELETE, en la misma transacción.
-- Se mantienen la FK y su cascada para diseños sin logros protegidos.
BEGIN;
ALTER TABLE intento ALTER COLUMN id_diseno DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid='intento'::regclass AND conname='chk_intento_sin_diseno_completado') THEN
    ALTER TABLE intento ADD CONSTRAINT chk_intento_sin_diseno_completado
      CHECK (id_diseno IS NOT NULL OR estado IS NOT DISTINCT FROM 'COMPLETADO');
  END IF;
END $$;
COMMIT;
