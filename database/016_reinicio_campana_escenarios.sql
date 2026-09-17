/*
  Separa el progreso de la campaña actual de los logros históricos.
  No elimina intentos, diseños, simulaciones ni resultados existentes.
  Ejecutar una vez sobre PostgreSQL antes de iniciar esta versión.
*/
BEGIN;

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS numero_campana_actual INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS campana_completada_historicamente BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE usuario
  DROP CONSTRAINT IF EXISTS chk_usuario_numero_campana_actual;

ALTER TABLE usuario
  ADD CONSTRAINT chk_usuario_numero_campana_actual
  CHECK (numero_campana_actual > 0);

ALTER TABLE intento
  ADD COLUMN IF NOT EXISTS numero_campana INTEGER NOT NULL DEFAULT 1;

ALTER TABLE intento
  DROP CONSTRAINT IF EXISTS chk_intento_numero_campana;

ALTER TABLE intento
  ADD CONSTRAINT chk_intento_numero_campana
  CHECK (numero_campana > 0);

CREATE INDEX IF NOT EXISTS idx_intento_usuario_campana_escenario
  ON intento (id_usuario, numero_campana, id_escenario, id_intento DESC);

UPDATE usuario usuario_actual
SET campana_completada_historicamente = TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM escenario escenario_nivel
    WHERE escenario_nivel.progresivo = TRUE
      AND escenario_nivel.modo = 'NIVEL'
      AND NOT EXISTS (
          SELECT 1
          FROM intento intento_completado
          WHERE intento_completado.id_usuario = usuario_actual.id_usuario
            AND intento_completado.id_escenario = escenario_nivel.id_escenario
            AND intento_completado.estado = 'COMPLETADO'
      )
)
AND EXISTS (
    SELECT 1
    FROM escenario escenario_nivel
    WHERE escenario_nivel.progresivo = TRUE
      AND escenario_nivel.modo = 'NIVEL'
);

COMMIT;
