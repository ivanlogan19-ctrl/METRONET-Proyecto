/*
=========================================================
METRONET

Antes de ejecutar este script:

1. Crear una base de datos llamada:

metronet

2. Abrir una conexión a esa base.

 3. Ejecutar este archivo completo en una base nueva.

 Este script no borra tablas existentes. Para reiniciar una base de desarrollo,
 usar una operación explícita y separada sobre una base descartable.
=========================================================
*/ 

CREATE TABLE usuario (
  id_usuario SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rol VARCHAR(20) NOT NULL,
  numero_campana_actual INTEGER NOT NULL DEFAULT 1,
  campana_completada_historicamente BOOLEAN NOT NULL DEFAULT FALSE,

  CONSTRAINT chk_usuario_rol
  CHECK (rol IN ('ADMIN', 'JUGADOR')),

  CONSTRAINT chk_usuario_numero_campana_actual
  CHECK (numero_campana_actual > 0)
);

CREATE TABLE solicitud_recuperacion_contrasena (
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
  FOREIGN KEY (id_usuario)
  REFERENCES usuario(id_usuario)
  ON DELETE CASCADE,

  CONSTRAINT chk_solicitud_recuperacion_estado
  CHECK (estado IN ('PENDIENTE', 'VERIFICADA', 'UTILIZADA', 'VENCIDA', 'BLOQUEADA', 'INVALIDADA', 'ATENDIDA'))
);

CREATE INDEX idx_recuperacion_contrasena_usuario_fecha
  ON solicitud_recuperacion_contrasena (id_usuario, fecha_solicitud DESC);

CREATE INDEX idx_recuperacion_contrasena_estado_expiracion
  ON solicitud_recuperacion_contrasena (estado, fecha_expiracion);

CREATE TABLE configuracion (
  clave VARCHAR(100) PRIMARY KEY,
  valor VARCHAR(255) NOT NULL,
  descripcion VARCHAR(255) NOT NULL
);

INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('velocidad_simulacion', '1', 'Velocidad predeterminada de las simulaciones'),
  ('capacidad_unidad', '300', 'Capacidad predeterminada de una unidad de metro'),
  ('modo_mantenimiento', 'desactivado', 'Estado general de mantenimiento de la plataforma');

CREATE TABLE diseno (
  id_diseno SERIAL PRIMARY KEY
);

CREATE TABLE escenario (
  id_escenario SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  id_diseno_base INTEGER,
  objetivo TEXT,
  dificultad VARCHAR(20) NOT NULL DEFAULT 'Inicial',
  instrucciones TEXT,
  numero INTEGER,
  modo VARCHAR(30) NOT NULL,

  CONSTRAINT fk_escenario_diseno
  FOREIGN KEY (id_diseno_base)
  REFERENCES diseno(id_diseno)
  ON DELETE SET NULL,

  CONSTRAINT chk_escenario_modo
  CHECK (modo IN ('NIVEL', 'EDICION_LIBRE')),

  CONSTRAINT chk_escenario_numero
  CHECK (
    (modo = 'NIVEL' AND numero IS NOT NULL)
    OR
    (modo = 'EDICION_LIBRE' AND numero IS NULL)
  ),

  CONSTRAINT chk_escenario_diseno_base
  CHECK (
    (modo = 'NIVEL' AND id_diseno_base IS NOT NULL)
    OR
    (modo = 'EDICION_LIBRE')
  )
);

CREATE TABLE intento (
  id_intento SERIAL PRIMARY KEY,
  id_usuario INTEGER NOT NULL,
  id_escenario INTEGER NOT NULL,
  id_diseno INTEGER NOT NULL UNIQUE,
  numero_campana INTEGER NOT NULL DEFAULT 1,
  estado VARCHAR(50),
  puntaje INTEGER,

  CONSTRAINT fk_intento_usuario
  FOREIGN KEY (id_usuario)
  REFERENCES usuario(id_usuario)
  ON DELETE CASCADE,

  CONSTRAINT fk_intento_escenario
  FOREIGN KEY (id_escenario)
  REFERENCES escenario(id_escenario)
  ON DELETE CASCADE,

  CONSTRAINT fk_intento_diseno
  FOREIGN KEY (id_diseno)
  REFERENCES diseno(id_diseno)
  ON DELETE CASCADE,

  CONSTRAINT chk_intento_puntaje
  CHECK (puntaje IS NULL OR puntaje >= 0),

  CONSTRAINT chk_intento_numero_campana
  CHECK (numero_campana > 0)
);

CREATE INDEX idx_intento_usuario_campana_escenario
  ON intento (id_usuario, numero_campana, id_escenario, id_intento DESC);

CREATE TABLE linea (
  id_diseno INTEGER NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  modificable BOOLEAN NOT NULL DEFAULT TRUE,

  PRIMARY KEY (id_diseno, nombre),

  CONSTRAINT fk_linea_diseno
  FOREIGN KEY (id_diseno)
  REFERENCES diseno(id_diseno)
  ON DELETE CASCADE
);

CREATE TABLE estacion (
  id_diseno INTEGER NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  posicion_x NUMERIC(10,2) NOT NULL,
  posicion_y NUMERIC(10,2) NOT NULL,
  transbordo BOOLEAN NOT NULL DEFAULT FALSE,
  modificable BOOLEAN NOT NULL DEFAULT TRUE,

  PRIMARY KEY (id_diseno, nombre),

  CONSTRAINT fk_estacion_diseno
  FOREIGN KEY (id_diseno)
  REFERENCES diseno(id_diseno)
  ON DELETE CASCADE
);

CREATE TABLE pasa (
  id_diseno INTEGER NOT NULL,
  nombre_linea VARCHAR(100) NOT NULL,
  nombre_estacion VARCHAR(100) NOT NULL,

  PRIMARY KEY (id_diseno, nombre_linea, nombre_estacion),

  CONSTRAINT fk_pasa_linea
  FOREIGN KEY (id_diseno, nombre_linea)
  REFERENCES linea(id_diseno, nombre)
  ON DELETE CASCADE,

  CONSTRAINT fk_pasa_estacion
  FOREIGN KEY (id_diseno, nombre_estacion)
  REFERENCES estacion(id_diseno, nombre)
  ON DELETE CASCADE
);

CREATE TABLE tramo (
  id_tramo SERIAL PRIMARY KEY,
  id_diseno INTEGER NOT NULL,
  nombre_linea VARCHAR(100) NOT NULL,
  nombre_estacion_a VARCHAR(100) NOT NULL,
  nombre_estacion_b VARCHAR(100) NOT NULL,

  CONSTRAINT fk_tramo_linea
  FOREIGN KEY (id_diseno, nombre_linea)
  REFERENCES linea(id_diseno, nombre)
  ON DELETE CASCADE,

  CONSTRAINT fk_tramo_estacion_a
  FOREIGN KEY (id_diseno, nombre_estacion_a)
  REFERENCES estacion(id_diseno, nombre)
  ON DELETE CASCADE,

  CONSTRAINT fk_tramo_estacion_b
  FOREIGN KEY (id_diseno, nombre_estacion_b)
  REFERENCES estacion(id_diseno, nombre)
  ON DELETE CASCADE,

  CONSTRAINT chk_tramo_estaciones_distintas
  CHECK (nombre_estacion_a <> nombre_estacion_b)
);

CREATE TABLE metro (
  id_tren SERIAL PRIMARY KEY,
  id_diseno INTEGER NOT NULL,
  nombre_linea VARCHAR(100) NOT NULL,
  capacidad INTEGER NOT NULL,
  velocidad_promedio NUMERIC(6,2) NOT NULL,

  CONSTRAINT fk_metro_linea
  FOREIGN KEY (id_diseno, nombre_linea)
  REFERENCES linea(id_diseno, nombre)
  ON DELETE CASCADE,

  CONSTRAINT chk_metro_capacidad
  CHECK (capacidad > 0),

  CONSTRAINT chk_metro_velocidad
  CHECK (velocidad_promedio > 0)
);

CREATE TABLE simulacion (
  id_simulacion SERIAL PRIMARY KEY,
  id_intento INTEGER NOT NULL,
  velocidad NUMERIC(6,2),
  duracion INTEGER,
  comentarios TEXT,
  estado VARCHAR(30) NOT NULL DEFAULT 'COMPLETADA',
  puntaje INTEGER,
  fecha_ejecucion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_simulacion_intento
  FOREIGN KEY (id_intento)
  REFERENCES intento(id_intento)
  ON DELETE CASCADE,

  CONSTRAINT chk_simulacion_velocidad
  CHECK (velocidad IS NULL OR velocidad >= 0),

  CONSTRAINT chk_simulacion_duracion
  CHECK (duracion IS NULL OR duracion >= 0)
);
