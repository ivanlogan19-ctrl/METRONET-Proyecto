-- Habilita la operación ADMIN de limpieza de versiones antiguas sin uso.
-- No elimina datos ni cambia tablas, columnas o claves foráneas.
-- El Service conserva la publicación vigente, la base del borrador y las
-- versiones vinculadas a intentos, bajo el bloqueo del escenario.
BEGIN;
GRANT DELETE ON TABLE nivel_publicacion,nivel_publicacion_tarjeta TO metronet_app;
COMMIT;
