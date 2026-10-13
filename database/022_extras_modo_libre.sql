-- Cambio formal aprobado: Extras y premio por siete tarjetas distintas.
BEGIN;
CREATE TABLE IF NOT EXISTS aprendizaje_extra_usuario (
  id_usuario INTEGER PRIMARY KEY REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  desbloqueado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  bienvenida_vista BOOLEAN NOT NULL DEFAULT FALSE,
  premio_obtenido_en TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS aprendizaje_extra_visita (
  id_usuario INTEGER NOT NULL REFERENCES aprendizaje_extra_usuario(id_usuario) ON DELETE CASCADE,
  tarjeta INTEGER NOT NULL CHECK (tarjeta BETWEEN 1 AND 7),
  visitada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario, tarjeta)
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='metronet_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON aprendizaje_extra_usuario, aprendizaje_extra_visita TO metronet_app;
  END IF;
END $$;
COMMIT;
