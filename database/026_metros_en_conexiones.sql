-- Cambio formal aprobado: metro propio de una línea o de una conexión, nunca de ambas.
BEGIN;
ALTER TABLE conexion_lineas ADD CONSTRAINT uq_conexion_diseno_id UNIQUE (id_diseno, id_conexion);
ALTER TABLE metro ADD COLUMN id_conexion BIGINT;
ALTER TABLE metro ALTER COLUMN nombre_linea DROP NOT NULL;
ALTER TABLE metro ADD CONSTRAINT chk_metro_recorrido_exclusivo
    CHECK ((nombre_linea IS NOT NULL) <> (id_conexion IS NOT NULL));
ALTER TABLE metro ADD CONSTRAINT fk_metro_conexion
    FOREIGN KEY (id_diseno, id_conexion) REFERENCES conexion_lineas(id_diseno, id_conexion)
    ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX idx_metro_conexion ON metro(id_diseno, id_conexion) WHERE id_conexion IS NOT NULL;
COMMIT;
