ALTER TABLE escenario
  ADD COLUMN IF NOT EXISTS progresivo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE escenario
  DROP CONSTRAINT IF EXISTS chk_escenario_diseno_base;

ALTER TABLE escenario
  ADD CONSTRAINT chk_escenario_diseno_base CHECK (modo IN ('NIVEL', 'EDICION_LIBRE'));

ALTER TABLE escenario
  ADD COLUMN IF NOT EXISTS reglas_exito JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE escenario
  ADD COLUMN IF NOT EXISTS herramientas_habilitadas JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE intento
  ADD COLUMN IF NOT EXISTS progreso INTEGER NOT NULL DEFAULT 0;

ALTER TABLE intento
  ADD COLUMN IF NOT EXISTS fecha_finalizacion TIMESTAMP;

ALTER TABLE intento
  DROP CONSTRAINT IF EXISTS chk_intento_progreso;

ALTER TABLE intento
  ADD CONSTRAINT chk_intento_progreso CHECK (progreso >= 0 AND progreso <= 100);

INSERT INTO escenario (nombre, objetivo, numero, modo, dificultad, instrucciones, progresivo, reglas_exito, herramientas_habilitadas)
SELECT 'Nivel 1 · Red inicial', 'Creá una línea con al menos dos estaciones sobre el mapa.', 1, 'NIVEL', 'Inicial', 'Ubicá dos estaciones y unilas mediante una línea de metro.', TRUE,
  '{"minimoEstaciones":2,"minimoLineas":1}',
  '{"estaciones":true,"lineas":true,"conexiones":false,"metros":false,"simulacion":false}'
WHERE NOT EXISTS (SELECT 1 FROM escenario WHERE progresivo = TRUE AND numero = 1);

INSERT INTO escenario (nombre, objetivo, numero, modo, dificultad, instrucciones, progresivo, reglas_exito, herramientas_habilitadas)
SELECT 'Nivel 2 · Conexiones', 'Construí un recorrido con tres estaciones y dos conexiones.', 2, 'NIVEL', 'Inicial', 'Agregá estaciones y conexiones para completar el recorrido de una línea.', TRUE,
  '{"minimoEstaciones":3,"minimoLineas":1,"minimoTramos":2}',
  '{"estaciones":true,"lineas":true,"conexiones":true,"metros":false,"simulacion":false}'
WHERE NOT EXISTS (SELECT 1 FROM escenario WHERE progresivo = TRUE AND numero = 2);

INSERT INTO escenario (nombre, objetivo, numero, modo, dificultad, instrucciones, progresivo, reglas_exito, herramientas_habilitadas)
SELECT 'Nivel 3 · Unidades de metro', 'Asigná una unidad de metro a una red con recorrido válido.', 3, 'NIVEL', 'Intermedio', 'Construí una red conectada y agregá una unidad de metro a una de sus líneas.', TRUE,
  '{"minimoEstaciones":3,"minimoLineas":1,"minimoTramos":2,"minimoMetros":1}',
  '{"estaciones":true,"lineas":true,"conexiones":true,"metros":true,"simulacion":false}'
WHERE NOT EXISTS (SELECT 1 FROM escenario WHERE progresivo = TRUE AND numero = 3);

INSERT INTO escenario (nombre, objetivo, numero, modo, dificultad, instrucciones, progresivo, reglas_exito, herramientas_habilitadas)
SELECT 'Nivel 4 · Simulación completa', 'Validá la red, asigná un metro y ejecutá una simulación.', 4, 'NIVEL', 'Avanzado', 'Completá una red válida y simulá la circulación de la unidad de metro.', TRUE,
  '{"minimoEstaciones":3,"minimoLineas":1,"minimoTramos":2,"minimoMetros":1,"requiereRedValida":true,"requiereSimulacion":true}',
  '{"estaciones":true,"lineas":true,"conexiones":true,"metros":true,"simulacion":true}'
WHERE NOT EXISTS (SELECT 1 FROM escenario WHERE progresivo = TRUE AND numero = 4);

INSERT INTO escenario (nombre, objetivo, modo, dificultad, instrucciones, progresivo, reglas_exito, herramientas_habilitadas)
SELECT 'Modo Libre', 'Diseñá, editá y simulá una red de metro sin consignas obligatorias.', 'EDICION_LIBRE', 'Libre', 'Todas las herramientas están disponibles.', TRUE,
  '{}',
  '{"estaciones":true,"lineas":true,"conexiones":true,"metros":true,"simulacion":true}'
WHERE NOT EXISTS (SELECT 1 FROM escenario WHERE progresivo = TRUE AND modo = 'EDICION_LIBRE');
