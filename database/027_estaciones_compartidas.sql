-- Cambio formal aprobado: conexión explícita en una estación compartida.
-- Ejecutar con respaldo previo. Una geometría ambigua aborta TODA la transacción.
BEGIN;
LOCK TABLE diseno, linea, estacion, pasa, tramo, conexion_lineas, metro IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE archivo_redes_conexion_via (
    id_diseno INTEGER PRIMARY KEY,
    archivado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    red JSONB NOT NULL
);
-- Copia completa recuperable; no depende de cascadas del diseño original.
INSERT INTO archivo_redes_conexion_via(id_diseno,red)
SELECT d.id_diseno,jsonb_build_object(
    'lineas',(SELECT jsonb_agg(to_jsonb(l)) FROM linea l WHERE l.id_diseno=d.id_diseno),
    'estaciones',(SELECT jsonb_agg(to_jsonb(e)) FROM estacion e WHERE e.id_diseno=d.id_diseno),
    'paradas',(SELECT jsonb_agg(to_jsonb(p)) FROM pasa p WHERE p.id_diseno=d.id_diseno),
    'tramos',(SELECT jsonb_agg(to_jsonb(t)) FROM tramo t WHERE t.id_diseno=d.id_diseno),
    'conexiones',(SELECT jsonb_agg(to_jsonb(c)) FROM conexion_lineas c WHERE c.id_diseno=d.id_diseno),
    'metros',(SELECT jsonb_agg(to_jsonb(m)) FROM metro m WHERE m.id_diseno=d.id_diseno))
FROM diseno d WHERE EXISTS (SELECT 1 FROM conexion_lineas c WHERE c.id_diseno=d.id_diseno );
DO $$
DECLARE c RECORD; extremo TEXT; compartida TEXT; linea_origen TEXT;
BEGIN
    FOR c IN SELECT * FROM conexion_lineas WHERE estacion_a<>estacion_b ORDER BY id_conexion LOOP
        -- Se conserva la geometría: la antigua vía pasa a prolongar una línea desde su extremo.
        -- Nunca se fusionan estaciones ni se desplazan sus coordenadas.
        extremo := c.estacion_a; compartida := c.estacion_b; linea_origen := c.linea_a;
        IF (SELECT count(*) FROM tramo WHERE id_diseno=c.id_diseno AND nombre_linea=linea_origen
            AND extremo IN (nombre_estacion_a,nombre_estacion_b)) <> 1
            OR EXISTS (SELECT 1 FROM pasa WHERE id_diseno=c.id_diseno AND nombre_linea=linea_origen AND nombre_estacion=compartida) THEN
            extremo := c.estacion_b; compartida := c.estacion_a; linea_origen := c.linea_b;
        END IF;
        IF (SELECT count(*) FROM tramo WHERE id_diseno=c.id_diseno AND nombre_linea=linea_origen
            AND extremo IN (nombre_estacion_a,nombre_estacion_b)) <> 1
            OR EXISTS (SELECT 1 FROM pasa WHERE id_diseno=c.id_diseno AND nombre_linea=linea_origen AND nombre_estacion=compartida) THEN
            RAISE EXCEPTION 'Diseño %, conexión %: requiere revisión manual; no se modificó ninguna red',c.id_diseno,c.id_conexion;
        END IF;
        INSERT INTO pasa(id_diseno,nombre_linea,nombre_estacion) VALUES(c.id_diseno,linea_origen,compartida);
        INSERT INTO tramo(id_diseno,nombre_linea,nombre_estacion_a,nombre_estacion_b) VALUES(c.id_diseno,linea_origen,extremo,compartida);
        UPDATE conexion_lineas SET estacion_a=compartida,estacion_b=compartida WHERE id_conexion=c.id_conexion;
    END LOOP;
END $$;
-- Las unidades del concepto retirado quedan en la copia recuperable, nunca reasignadas arbitrariamente.
DELETE FROM metro WHERE id_conexion IS NOT NULL;
-- Diferida para permitir el renombrado en cascada de las dos membresías de PASA.
CREATE FUNCTION validar_estacion_compartida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM conexion_lineas WHERE id_conexion=NEW.id_conexion AND estacion_a<>estacion_b) THEN
        RAISE EXCEPTION 'La conexión requiere una misma estación en ambas líneas' USING ERRCODE='23514';
    END IF;
    RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER chk_conexion_estacion_compartida
AFTER INSERT OR UPDATE ON conexion_lineas DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validar_estacion_compartida();
ALTER TABLE metro ADD CONSTRAINT chk_metro_solo_linea CHECK(id_conexion IS NULL);
ALTER TABLE metro ALTER COLUMN nombre_linea SET NOT NULL;
COMMENT ON TABLE archivo_redes_conexion_via IS 'Respaldo previo a estaciones compartidas; no participa en el juego ni en su puntuación';
CREATE TABLE archivo_intentos_conexion_via (
    id_intento INTEGER PRIMARY KEY,
    archivado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    contenido JSONB NOT NULL
);
GRANT SELECT,INSERT ON archivo_intentos_conexion_via TO metronet_app;
COMMIT;
