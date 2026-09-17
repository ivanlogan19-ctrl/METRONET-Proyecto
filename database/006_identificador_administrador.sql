ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS identificador_administrador VARCHAR(100);

UPDATE usuario
SET identificador_administrador = nombre
WHERE rol = 'ADMIN'
  AND identificador_administrador IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_identificador_administrador
  ON usuario (identificador_administrador)
  WHERE identificador_administrador IS NOT NULL;
