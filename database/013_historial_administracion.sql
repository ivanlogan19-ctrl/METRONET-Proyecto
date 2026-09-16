CREATE TABLE IF NOT EXISTS actividad_administrativa (
    id_actividad SERIAL PRIMARY KEY,
    id_administrador INTEGER NOT NULL REFERENCES usuario(id_usuario),
    accion VARCHAR(100) NOT NULL,
    detalle VARCHAR(500) NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
