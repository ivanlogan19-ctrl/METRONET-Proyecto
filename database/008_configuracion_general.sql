CREATE TABLE IF NOT EXISTS configuracion (
  clave VARCHAR(100) PRIMARY KEY,
  valor VARCHAR(255) NOT NULL,
  descripcion VARCHAR(255) NOT NULL
);

INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('velocidad_simulacion', '1', 'Velocidad predeterminada de las simulaciones'),
  ('capacidad_unidad', '300', 'Capacidad predeterminada de una unidad de metro'),
  ('modo_mantenimiento', 'desactivado', 'Estado general de mantenimiento de la plataforma')
ON CONFLICT (clave) DO NOTHING;
