CREATE TABLE IF NOT EXISTS solicitud_recuperacion_contrasena (
  id_solicitud SERIAL PRIMARY KEY,
  id_usuario INTEGER NOT NULL,
  fecha_solicitud TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  codigo_hash VARCHAR(255),
  token_recuperacion_hash VARCHAR(255),
  fecha_expiracion TIMESTAMP,
  fecha_ultimo_envio TIMESTAMP,
  fecha_verificacion TIMESTAMP,
  fecha_expiracion_autorizacion TIMESTAMP,
  intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  utilizado BOOLEAN NOT NULL DEFAULT FALSE,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  CONSTRAINT fk_solicitud_recuperacion_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  CONSTRAINT chk_solicitud_recuperacion_estado
    CHECK (estado IN ('PENDIENTE', 'VERIFICADA', 'UTILIZADA', 'VENCIDA', 'BLOQUEADA', 'INVALIDADA', 'ATENDIDA'))
);

CREATE INDEX IF NOT EXISTS idx_recuperacion_contrasena_usuario_fecha
  ON solicitud_recuperacion_contrasena (id_usuario, fecha_solicitud DESC);

CREATE INDEX IF NOT EXISTS idx_recuperacion_contrasena_estado_expiracion
  ON solicitud_recuperacion_contrasena (estado, fecha_expiracion);
