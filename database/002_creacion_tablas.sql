/*
=========================================================
METRONET

Antes de ejecutar este script:

1. Crear una base de datos llamada:

metronet

2. Abrir una conexión a esa base.

3. Ejecutar este archivo completo.
=========================================================
*/ 

-- Limpieza

DROP TABLE IF EXISTS simulacion CASCADE;
DROP TABLE IF EXISTS metro CASCADE;
DROP TABLE IF EXISTS pasa CASCADE;
DROP TABLE IF EXISTS tramo CASCADE;
DROP TABLE IF EXISTS estacion CASCADE;
DROP TABLE IF EXISTS linea CASCADE;
DROP TABLE IF EXISTS intento CASCADE;
DROP TABLE IF EXISTS escenario CASCADE;
DROP TABLE IF EXISTS diseno CASCADE;
DROP TABLE IF EXISTS usuario CASCADE;

CREATE TABLE usuario (
  id_usuario SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rol VARCHAR(20) NOT NULL,

  CONSTRAINT chk_usuario_rol
  CHECK (rol IN ('ADMIN', 'JUGADOR'))
);

CREATE TABLE diseno (
  id_diseno SERIAL PRIMARY KEY
);

CREATE TABLE escenario (
  id_escenario SERIAL PRIMARY KEY,
  id_diseno_base INTEGER,
  objetivo TEXT,
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
  CHECK (puntaje IS NULL OR puntaje >= 0)
);

CREATE TABLE linea (
  id_linea SERIAL PRIMARY KEY,
  id_diseno INTEGER NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  modificable BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT uq_linea_nombre_diseno
      UNIQUE (id_diseno, nombre),

  CONSTRAINT fk_linea_diseno
      FOREIGN KEY (id_diseno)
      REFERENCES diseno(id_diseno)
      ON DELETE CASCADE
);

CREATE TABLE estacion (
  id_estacion SERIAL PRIMARY KEY,
  id_diseno INTEGER NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  posicion_x DOUBLE PRECISION NOT NULL,
  posicion_y DOUBLE PRECISION NOT NULL,
  transbordo BOOLEAN NOT NULL DEFAULT FALSE,
  modificable BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT uq_estacion_nombre_diseno
      UNIQUE (id_diseno, nombre),

  CONSTRAINT fk_estacion_diseno
      FOREIGN KEY (id_diseno)
      REFERENCES diseno(id_diseno)
      ON DELETE CASCADE
);

CREATE TABLE tramo (
    id_tramo SERIAL PRIMARY KEY,

    id_diseno INTEGER NOT NULL,
    nombre_linea VARCHAR(100) NOT NULL,
    estacion_a VARCHAR(100) NOT NULL,
    estacion_b VARCHAR(100) NOT NULL,

    CONSTRAINT uq_tramo
        UNIQUE (id_diseno, nombre_linea, estacion_a, estacion_b),

    CONSTRAINT fk_tramo_linea
        FOREIGN KEY (id_diseno, nombre_linea)
        REFERENCES linea(id_diseno, nombre)
        ON DELETE CASCADE,

    CONSTRAINT fk_tramo_estacion_a
        FOREIGN KEY (id_diseno, estacion_a)
        REFERENCES estacion(id_diseno, nombre)
        ON DELETE CASCADE,

    CONSTRAINT fk_tramo_estacion_b
        FOREIGN KEY (id_diseno, estacion_b)
        REFERENCES estacion(id_diseno, nombre)
        ON DELETE CASCADE,

    CONSTRAINT ck_tramo_estaciones_distintas
        CHECK (estacion_a < estacion_b)
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

  CONSTRAINT fk_simulacion_intento
  FOREIGN KEY (id_intento)
  REFERENCES intento(id_intento)
  ON DELETE CASCADE,

  CONSTRAINT chk_simulacion_velocidad
  CHECK (velocidad IS NULL OR velocidad >= 0),

  CONSTRAINT chk_simulacion_duracion
  CHECK (duracion IS NULL OR duracion >= 0)
);