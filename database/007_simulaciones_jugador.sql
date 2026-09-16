ALTER TABLE escenario
  ADD COLUMN IF NOT EXISTS nombre VARCHAR(100);

UPDATE escenario
SET nombre = COALESCE(nombre, CONCAT('Simulación ', id_escenario));

ALTER TABLE escenario
  ALTER COLUMN nombre SET NOT NULL;

CREATE TABLE IF NOT EXISTS tramo (
  id_tramo SERIAL PRIMARY KEY,
  id_diseno INTEGER NOT NULL,
  nombre_linea VARCHAR(100) NOT NULL,
  nombre_estacion_a VARCHAR(100) NOT NULL,
  nombre_estacion_b VARCHAR(100) NOT NULL,
  CONSTRAINT fk_tramo_linea FOREIGN KEY (id_diseno, nombre_linea)
    REFERENCES linea(id_diseno, nombre) ON DELETE CASCADE,
  CONSTRAINT fk_tramo_estacion_a FOREIGN KEY (id_diseno, nombre_estacion_a)
    REFERENCES estacion(id_diseno, nombre) ON DELETE CASCADE,
  CONSTRAINT fk_tramo_estacion_b FOREIGN KEY (id_diseno, nombre_estacion_b)
    REFERENCES estacion(id_diseno, nombre) ON DELETE CASCADE,
  CONSTRAINT chk_tramo_estaciones_distintas
    CHECK (nombre_estacion_a <> nombre_estacion_b)
);
