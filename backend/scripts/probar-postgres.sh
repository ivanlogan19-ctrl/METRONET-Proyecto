#!/usr/bin/env bash
# Ejecutar desde cualquier directorio: bash backend/scripts/probar-postgres.sh
# Sin argumentos ejecuta *PostgresTest; para toda la suite: ... -DfailIfNoTests=true
# Requiere PostgreSQL local, Python 3 y Java 21. No conecta a la base de la aplicación.
set -euo pipefail

raiz=$(cd "$(dirname "$0")/../.." && pwd)
pg_bin=${METRONET_POSTGRES_BIN:-}
if [[ -z "$pg_bin" ]] && command -v pg_config >/dev/null; then
  pg_bin=$(pg_config --bindir)
fi
if [[ ! -x "$pg_bin/initdb" ]]; then
  for candidato in /opt/homebrew/opt/postgresql@*/bin /usr/local/opt/postgresql@*/bin /usr/lib/postgresql/*/bin; do
    if [[ -x "$candidato/initdb" ]]; then pg_bin=$candidato; fi
  done
fi
if [[ ! -x "$pg_bin/initdb" ]]; then
  echo 'Falta PostgreSQL local. Indicá su directorio bin con METRONET_POSTGRES_BIN.' >&2
  exit 1
fi
if [[ -z "${JAVA_HOME:-}" && -d /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ]]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
fi

temporal=$(mktemp -d "${TMPDIR:-/tmp}/metronet-pruebas-pg.XXXXXX")
preparado=false
limpiar() {
  resultado=$?
  trap - EXIT
  if [[ -f "$temporal/datos/postmaster.pid" ]]; then
    if ! "$pg_bin/pg_ctl" -D "$temporal/datos" -m immediate -w stop >/dev/null; then
      echo "No se pudo detener PostgreSQL temporal: $temporal" >&2
      exit 1
    fi
  fi
  if [[ "$resultado" != 0 && "$preparado" == false ]]; then
    cat "$temporal/preparacion.log" >&2
  fi
  rm -rf -- "$temporal"
  exit "$resultado"
}
trap limpiar EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
touch "$temporal/preparacion.log"
puerto=$(python3 - <<'PY'
import socket
while True:
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        puerto = s.getsockname()[1]
    if puerto != 5432:
        print(puerto)
        break
PY
)
export METRONET_TEST_POSTGRES_USER=metronet_pruebas
export METRONET_TEST_POSTGRES_PASSWORD=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
printf '%s\n' "$METRONET_TEST_POSTGRES_PASSWORD" > "$temporal/clave"
chmod 600 "$temporal/clave"
"$pg_bin/initdb" -D "$temporal/datos" -U "$METRONET_TEST_POSTGRES_USER" \
  --auth-local=trust --auth-host=scram-sha-256 --pwfile="$temporal/clave" \
  --encoding=UTF8 --locale=C >> "$temporal/preparacion.log" 2>&1
"$pg_bin/pg_ctl" -D "$temporal/datos" -l "$temporal/servidor.log" \
  -o "-h 127.0.0.1 -p $puerto -k $temporal" -w start >> "$temporal/preparacion.log" 2>&1
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$temporal" -p "$puerto" -U "$METRONET_TEST_POSTGRES_USER")
if [[ "$temporal" != *"/metronet-pruebas-pg."* || "$puerto" == 5432 ]]; then
  echo 'El destino PostgreSQL no es el clúster temporal esperado.' >&2
  exit 1
fi
"${psql[@]}" -d postgres -c 'CREATE DATABASE metronet_pruebas' >> "$temporal/preparacion.log" 2>&1
"${psql[@]}" -d postgres -c 'CREATE ROLE metronet_app NOLOGIN' >> "$temporal/preparacion.log" 2>&1
for archivo in "$raiz"/database/*.sql; do
  case "$(basename "$archivo")" in
    001_creacion_base.sql|003_datos_prueba.sql) continue ;;
  esac
  if [[ "$(basename "$archivo")" == 018_administracion_niveles.sql ]]; then
    python3 - "$raiz/backend/src/main/resources/educacion/niveles.json" > "$temporal/niveles.sql" <<'PY'
import json,sys
def literal(valor): return "'" + str(valor).replace("'", "''") + "'"
for nivel in json.load(open(sys.argv[1])):
    datos = [literal(nivel[campo]) for campo in ('nombre','objetivo')]
    datos += [str(nivel['numero']),"'NIVEL'",literal(nivel['dificultad']),literal(nivel['instrucciones']),'TRUE']
    datos += [literal(json.dumps(nivel[campo],ensure_ascii=False))+'::jsonb' for campo in ('reglasExito','herramientasHabilitadas')]
    print('INSERT INTO escenario(nombre,objetivo,numero,modo,dificultad,instrucciones,progresivo,reglas_exito,herramientas_habilitadas)')
    print('SELECT '+','.join(datos)+' WHERE NOT EXISTS (SELECT 1 FROM escenario WHERE progresivo=TRUE AND modo=\'NIVEL\' AND numero='+str(nivel['numero'])+');')
    print('UPDATE escenario SET nombre='+datos[0]+',objetivo='+datos[1]+',dificultad='+datos[4]+',instrucciones='+datos[5]+',reglas_exito='+datos[7]+',herramientas_habilitadas='+datos[8]+' WHERE progresivo=TRUE AND modo=\'NIVEL\' AND numero='+str(nivel['numero'])+';')
    if nivel['numero']>=4:
        print('INSERT INTO criterio_uv_ut(id_escenario,version,limite_ut,presupuesto_uv) SELECT id_escenario,1,2,3 FROM escenario WHERE progresivo=TRUE AND modo=\'NIVEL\' AND numero='+str(nivel['numero'])+' ON CONFLICT(id_escenario) DO NOTHING;')
PY
    "${psql[@]}" -d metronet_pruebas -f "$temporal/niveles.sql" >> "$temporal/preparacion.log" 2>&1
  fi
  "${psql[@]}" -d metronet_pruebas -f "$archivo" >> "$temporal/preparacion.log" 2>&1
done
"${psql[@]}" -d metronet_pruebas -c "INSERT INTO usuario(nombre,email,password,rol) VALUES ('Prueba aislada','pruebas@example.invalid','!acceso-inhabilitado','JUGADOR')" >> "$temporal/preparacion.log" 2>&1
export METRONET_TEST_POSTGRES_URL="jdbc:postgresql://127.0.0.1:$puerto/metronet_pruebas"
preparado=true
echo 'PostgreSQL temporal preparado. Se eliminará al terminar; no se utiliza la base de METRONET.'
cd "$raiz/backend"
if [[ "${1:-}" == --administracion-e2e ]]; then
  # La interfaz utiliza el rol real de la aplicación dentro del clúster efímero.
  # Los permisos de las tablas de niveles provienen de 018/020, sin ampliarlos.
  "${psql[@]}" -d metronet_pruebas -v clave="$METRONET_TEST_POSTGRES_PASSWORD" >> "$temporal/preparacion.log" 2>&1 <<'SQL'
ALTER ROLE metronet_app LOGIN PASSWORD :'clave';
SELECT format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE %I TO metronet_app',tablename)
FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'nivel_%' \gexec
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO metronet_app;
SQL
  export METRONET_TEST_PSQL="$pg_bin/psql"
  ./mvnw -q -DskipTests package
  node --test "$raiz/frontend/tests/administracion-niveles-e2e.test.cjs"
  exit 0
fi
if [[ $# == 0 ]]; then set -- '-Dtest=*PostgresTest'; fi
./mvnw test "$@"
