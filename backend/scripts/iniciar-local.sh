#!/usr/bin/env bash
# Configuración privada de esta instalación, nunca incluida en Git.
set -euo pipefail
raiz=$(cd "$(dirname "$0")/../.." && pwd)
configuracion=${METRONET_ARCHIVO_ENTORNO:-$raiz/.local/configuracion/backend.env}
if [[ ! -f "$configuracion" ]]; then
  echo 'Falta configuración local. Prepará las variables METRONET según backend/.env.example.' >&2
  exit 1
fi
set -a
source "$configuracion"
set +a
export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}
cd "$raiz/backend"
# Empaquetar el código actual evita arrancar un JAR antiguo después de actualizar Git.
# Si falla la compilación, set -e impide ejecutar silenciosamente la versión anterior.
echo 'Preparando el servidor con el código actual de METRONET...'
./mvnw -q -DskipTests package
exec "$JAVA_HOME/bin/java" -jar target/backend-0.0.1-SNAPSHOT.jar "$@"
