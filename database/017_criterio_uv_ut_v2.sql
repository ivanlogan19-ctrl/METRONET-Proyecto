-- Configuración UV/UT aditiva. Las filas anteriores de intento y simulacion permanecen V1.
CREATE TABLE IF NOT EXISTS criterio_uv_ut (
  id_escenario INTEGER PRIMARY KEY REFERENCES escenario(id_escenario) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  limite_ut INTEGER NOT NULL CHECK (limite_ut > 0),
  presupuesto_uv NUMERIC(8,2) NOT NULL CHECK (presupuesto_uv > 0)
);

CREATE TABLE IF NOT EXISTS intento_uv_ut (
  id_intento INTEGER PRIMARY KEY REFERENCES intento(id_intento) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  limite_ut INTEGER NOT NULL CHECK (limite_ut > 0),
  presupuesto_uv NUMERIC(8,2) NOT NULL CHECK (presupuesto_uv > 0),
  reglas_exito JSONB NOT NULL,
  herramientas_habilitadas JSONB NOT NULL,
  objetivo TEXT,
  instrucciones TEXT
);

-- Estado V1 conocido al aplicar el corte. No es posible reconstruir versiones
-- anteriores del catálogo si ya se habían editado antes de esta migración.
CREATE TABLE IF NOT EXISTS intento_catalogo_v1 (
  id_intento INTEGER PRIMARY KEY REFERENCES intento(id_intento) ON DELETE CASCADE,
  reglas_exito JSONB NOT NULL,
  herramientas_habilitadas JSONB NOT NULL,
  objetivo TEXT,
  instrucciones TEXT,
  capturado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO intento_catalogo_v1(id_intento,reglas_exito,herramientas_habilitadas,objetivo,instrucciones)
SELECT i.id_intento,e.reglas_exito,e.herramientas_habilitadas,e.objetivo,e.instrucciones
FROM intento i JOIN escenario e ON e.id_escenario=i.id_escenario AND e.progresivo=TRUE AND e.modo='NIVEL'
WHERE NOT EXISTS (SELECT 1 FROM intento_uv_ut v WHERE v.id_intento=i.id_intento)
ON CONFLICT (id_intento) DO NOTHING;

CREATE OR REPLACE FUNCTION congelar_catalogo_intento_v1() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO intento_catalogo_v1(id_intento,reglas_exito,herramientas_habilitadas,objetivo,instrucciones)
  SELECT NEW.id_intento,e.reglas_exito,e.herramientas_habilitadas,e.objetivo,e.instrucciones
  FROM escenario e WHERE e.id_escenario=NEW.id_escenario AND e.progresivo=TRUE AND e.modo='NIVEL'
  ON CONFLICT (id_intento) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS congelar_catalogo_intento_v1 ON intento;
CREATE TRIGGER congelar_catalogo_intento_v1
AFTER INSERT ON intento FOR EACH ROW EXECUTE FUNCTION congelar_catalogo_intento_v1();

CREATE TABLE IF NOT EXISTS resultado_uv_ut (
  id_simulacion INTEGER PRIMARY KEY REFERENCES simulacion(id_simulacion) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  huella_problema TEXT NOT NULL,
  huella_ejecucion TEXT NOT NULL,
  limite_ut INTEGER NOT NULL,
  presupuesto_uv NUMERIC(8,2) NOT NULL,
  ut_ejecutadas INTEGER NOT NULL,
  suma_uv NUMERIC(8,2) NOT NULL,
  completo BOOLEAN NOT NULL,
  unidades JSONB NOT NULL
);

-- El rol de la aplicación conserva acceso a datos sin recibir propiedad ni DDL.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  criterio_uv_ut, intento_uv_ut, intento_catalogo_v1, resultado_uv_ut
TO metronet_app;
