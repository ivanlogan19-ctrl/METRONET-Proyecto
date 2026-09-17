/*
  Amplía la tabla existente de recuperación sin eliminar solicitudes ni usuarios.
  Ejecutar una vez sobre PostgreSQL antes de iniciar la versión con recuperación por código.
*/
BEGIN;

ALTER TABLE solicitud_recuperacion_contrasena
  ADD COLUMN IF NOT EXISTS codigo_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS token_recuperacion_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS fecha_expiracion TIMESTAMP,
  ADD COLUMN IF NOT EXISTS fecha_ultimo_envio TIMESTAMP,
  ADD COLUMN IF NOT EXISTS fecha_verificacion TIMESTAMP,
  ADD COLUMN IF NOT EXISTS fecha_expiracion_autorizacion TIMESTAMP,
  ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS utilizado BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE solicitud_recuperacion_contrasena
  DROP CONSTRAINT IF EXISTS chk_solicitud_recuperacion_estado;

ALTER TABLE solicitud_recuperacion_contrasena
  ADD CONSTRAINT chk_solicitud_recuperacion_estado
  CHECK (estado IN ('PENDIENTE', 'VERIFICADA', 'UTILIZADA', 'VENCIDA', 'BLOQUEADA', 'INVALIDADA', 'ATENDIDA'));

CREATE INDEX IF NOT EXISTS idx_recuperacion_contrasena_usuario_fecha
  ON solicitud_recuperacion_contrasena (id_usuario, fecha_solicitud DESC);

CREATE INDEX IF NOT EXISTS idx_recuperacion_contrasena_estado_expiracion
  ON solicitud_recuperacion_contrasena (estado, fecha_expiracion);

COMMIT;
