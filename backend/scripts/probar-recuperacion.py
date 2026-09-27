#!/usr/bin/env python3
"""Respalda una BD autorizada y restaura SOLO en un clúster temporal aislado.

Conexión de origen mediante PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSWORD o .pgpass.
Uso: METRONET_POSTGRES_BIN=/ruta/bin python3 backend/scripts/probar-recuperacion.py
Los datos quedan en .local/respaldos (ignorado por Git, permisos privados).
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
import time

os.umask(0o077)
raiz = Path(__file__).resolve().parents[2]
binario = Path(os.environ.get('METRONET_POSTGRES_BIN', '/opt/homebrew/opt/postgresql@17/bin'))
if not os.environ.get('PGDATABASE'):
    raise SystemExit('Indicá explícitamente la BD de origen mediante PGDATABASE.')

def ejecutar(programa, argumentos, entorno=None):
    resultado = subprocess.run([str(binario / programa), *argumentos], env=entorno, capture_output=True, text=True)
    if resultado.returncode:
        # Los mensajes del servidor pueden contener valores privados; no copiarlos al informe.
        raise RuntimeError(f'{programa} falló con código {resultado.returncode}; operación detenida.')
    return resultado.stdout.strip()

def consulta(sql, entorno=None):
    return ejecutar('psql', ['-X', '-w', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], entorno)

def resumen(entorno=None):
    tablas = consulta("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename", entorno).splitlines()
    datos = {}
    for tabla in tablas:
        identificador = '"' + tabla.replace('"', '""') + '"'
        resultado = consulta(f"SELECT count(*), md5(COALESCE(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text), '')) FROM public.{identificador} t", entorno)
        cantidad, huella = resultado.split('|')
        datos[tabla] = {'filas': int(cantidad), 'huella': huella}
    return datos

carpeta = raiz / '.local' / 'respaldos'
carpeta.mkdir(parents=True, exist_ok=True, mode=0o700)
marca = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
respaldo = carpeta / f'metronet-{marca}.dump'
origen = resumen()
ejecutar('pg_dump', ['-w', '-Fc', '--file', str(respaldo)])
os.chmod(respaldo, 0o600)
if resumen() != origen:
    raise RuntimeError('El origen cambió durante el respaldo. Repetir en una ventana sin escrituras.')

with tempfile.TemporaryDirectory(prefix='metronet-restauracion-') as directorio:
    temporal = Path(directorio)
    clave = secrets.token_urlsafe(32)
    (temporal / 'clave').write_text(clave)
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        puerto = str(s.getsockname()[1])
    destino = {**os.environ, 'PGHOST': str(temporal), 'PGPORT': puerto, 'PGUSER': 'restauracion', 'PGDATABASE': 'restauracion', 'PGPASSWORD': clave}
    ejecutar('initdb', ['-D', str(temporal / 'datos'), '-U', 'restauracion', '--auth-local=trust', '--auth-host=scram-sha-256', '--pwfile', str(temporal / 'clave'), '--encoding=UTF8', '--locale=C'])
    inicio = time.monotonic()
    try:
        ejecutar('pg_ctl', ['-D', str(temporal / 'datos'), '-l', str(temporal / 'servidor.log'), '-o', f'-h 127.0.0.1 -p {puerto} -k {temporal}', '-w', 'start'])
        ejecutar('createdb', ['restauracion'], {**destino, 'PGDATABASE': 'postgres'})
        ejecutar('pg_restore', ['-w', '--exit-on-error', '--no-owner', '--no-privileges', '-d', 'restauracion', str(respaldo)], destino)
        restaurado = resumen(destino)
        if origen != restaurado:
            raise RuntimeError('Los datos restaurados difieren del origen.')
        restricciones = int(consulta("SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='f' AND convalidated", destino))
        assert restricciones > 0
        duracion = round(time.monotonic() - inicio, 2)
    finally:
        if (temporal / 'datos' / 'postmaster.pid').exists():
            ejecutar('pg_ctl', ['-D', str(temporal / 'datos'), '-m', 'immediate', '-w', 'stop'])

informe = {'fechaUTC': marca, 'restauracion': 'verificada en clúster temporal eliminado', 'tablas': len(origen),
    'filas': {tabla: datos['filas'] for tabla, datos in origen.items()}, 'clavesForaneasValidadas': restricciones,
    'segundos': duracion, 'sha256': hashlib.sha256(respaldo.read_bytes()).hexdigest(), 'bytes': respaldo.stat().st_size}
(carpeta / f'metronet-{marca}.json').write_text(json.dumps(informe, indent=2) + '\n')
print(json.dumps({k: v for k, v in informe.items() if k != 'filas'}, indent=2))
print('Respaldo privado conservado en .local/respaldos; no se modificó la BD de origen.')
