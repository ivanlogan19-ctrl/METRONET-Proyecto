ALTER TABLE escenario
  ADD COLUMN IF NOT EXISTS dificultad VARCHAR(20) NOT NULL DEFAULT 'Inicial';

ALTER TABLE escenario
  ADD COLUMN IF NOT EXISTS instrucciones TEXT;

UPDATE escenario
SET instrucciones = COALESCE(instrucciones, 'Creá estaciones, unilas en líneas y validá la red antes de usarla.');
