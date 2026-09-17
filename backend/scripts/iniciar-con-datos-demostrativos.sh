#!/usr/bin/env sh
set -eu

directorio_script=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
restaurar_terminal() {
  stty echo
}
trap restaurar_terminal EXIT HUP INT TERM
printf '%s' 'Contraseña para Usuario Prueba: '
stty -echo
IFS= read -r contrasena_jugador
stty echo
printf '\n%s' 'Contraseña para Admin Prueba: '
stty -echo
IFS= read -r contrasena_administrador
stty echo
printf '\n'
if [ -z "$contrasena_jugador" ] || [ -z "$contrasena_administrador" ]; then
  printf '%s\n' 'Las dos contraseñas son obligatorias.' >&2
  exit 1
fi
export METRONET_DATOS_DEMOSTRATIVOS_HABILITADOS=true
export METRONET_DATOS_DEMOSTRATIVOS_CONTRASENA_JUGADOR="$contrasena_jugador"
export METRONET_DATOS_DEMOSTRATIVOS_CONTRASENA_ADMINISTRADOR="$contrasena_administrador"
trap - EXIT HUP INT TERM
cd "$directorio_script/.."
exec ./mvnw spring-boot:run
