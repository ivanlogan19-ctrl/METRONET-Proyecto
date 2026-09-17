#!/usr/bin/env sh
set -eu

directorio_script=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
restaurar_terminal() {
  stty echo
}
trap restaurar_terminal EXIT HUP INT TERM

printf '%s' 'Correo Gmail remitente: '
IFS= read -r correo_remitente
printf '%s' 'Contraseña de aplicación de Google: '
stty -echo
IFS= read -r contrasena_aplicacion
stty echo
printf '\n'
contrasena_aplicacion=$(printf '%s' "$contrasena_aplicacion" | tr -d '[:space:]')

if [ -z "$correo_remitente" ] || [ -z "$contrasena_aplicacion" ]; then
  printf '%s\n' 'El correo remitente y la contraseña de aplicación son obligatorios.' >&2
  exit 1
fi

export METRONET_SMTP_HABILITADO=true
export METRONET_SMTP_HOST=smtp.gmail.com
export METRONET_SMTP_PUERTO=587
export METRONET_SMTP_USUARIO="$correo_remitente"
export METRONET_SMTP_CONTRASENA="$contrasena_aplicacion"
export METRONET_SMTP_REMITENTE="$correo_remitente"
export METRONET_SMTP_AUTENTICACION=true
export METRONET_SMTP_STARTTLS=true
trap - EXIT HUP INT TERM
cd "$directorio_script/.."
exec ./mvnw spring-boot:run
