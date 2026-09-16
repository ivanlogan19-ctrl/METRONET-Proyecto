CREATE TABLE IF NOT EXISTS solicitud_recuperacion_contrasena (
  id_solicitud SERIAL PRIMARY KEY,
  id_usuario INTEGER NOT NULL,
  fecha_solicitud TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  CONSTRAINT fk_solicitud_recuperacion_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  CONSTRAINT chk_solicitud_recuperacion_estado
    CHECK (estado IN ('PENDIENTE', 'ATENDIDA'))
);
