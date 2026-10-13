"""Actualización conservadora: catálogo oficial, mes cerrado y publicación atómica.

Invocado por TraficoHistoricoService; usa solamente la biblioteca estándar.
"""
import calendar
from datetime import date, timedelta
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
import urllib.request
from urllib.parse import urlparse

sys.dont_write_bytecode = True
CATALOGO = 'https://ckan.montevideo.gub.uy/api/3/action/package_show?id=conteo-vehicular-en-las-principales-avenidas-de-montevideo'
HOSTS = {'ckan.montevideo.gub.uy', 'ckan-data.montevideo.gub.uy'}
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']


def validar_url(url):
    u = urlparse(url)
    if u.scheme != 'https' or u.hostname not in HOSTS or u.port not in (None, 443) or u.username or u.password:
        raise ValueError('Fuente no autorizada')
    return url


class RedireccionOficial(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validar_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def descargar(url, destino, limite):
    abrir = urllib.request.build_opener(RedireccionOficial())
    peticion = urllib.request.Request(validar_url(url), headers={'User-Agent': 'METRONET-Trafico/1.0'})
    with abrir.open(peticion, timeout=45) as r, Path(destino).open('wb') as f:
        total = 0
        while bloque := r.read(1024*1024):
            total += len(bloque)
            if total > limite:
                raise ValueError('Descarga demasiado grande')
            f.write(bloque)


def seleccionar(catalogo, hoy, vigente):
    if catalogo.get('success') is not True:
        raise ValueError('Catálogo inválido')
    candidatos = []
    for r in catalogo['result']['resources']:
        nombre = r.get('name', '').lower().replace('setiembre', 'septiembre')
        anio = re.search(r'\b(20\d{2})\b', nombre)
        meses = [i+1 for i, m in enumerate(MESES) if re.search(r'\b'+m+r'\b', nombre)]
        if not anio or len(meses) != 1:
            continue
        periodo = f'{anio.group(1)}-{meses[0]:02d}'
        if vigente < periodo < hoy.strftime('%Y-%m'):
            url = validar_url(r['url'])
            if not urlparse(url).path.lower().endswith('.zip'):
                continue
            candidatos.append((periodo, url))
    return max(candidatos, default=None)


def validar(datos, periodo=None, anterior=None):
    periodo = periodo or datos.get('periodo', '')
    if not re.fullmatch(r'20\d{2}-(0[1-9]|1[0-2])', periodo) or datos.get('periodo') != periodo or datos.get('version') != 1:
        raise ValueError('Período o versión inválidos')
    anio, mes = map(int, periodo.split('-'))
    esperadas = [f'{periodo}-{d:02d}' for d in range(1, calendar.monthrange(anio, mes)[1]+1)]
    if datos.get('revision', {}).get('fechas') != esperadas:
        raise ValueError('El archivo no cubre el mes completo')
    revision = datos['revision']
    if revision.get('registros', 0) <= 0 or revision.get('invalidos', 0) / revision['registros'] > .01:
        raise ValueError('Demasiados registros inválidos')
    tramos = datos.get('tramos', [])
    if not tramos or (anterior and len(tramos) < len(anterior['tramos'])*.5):
        raise ValueError('Cobertura insuficiente o caída superior al 50%')
    validas = 0
    for t in tramos:
        horas = t.get('intensidades', [])
        puntos = t.get('coordenadas', [])
        if len(horas) != 24 or len(puntos) < 2:
            raise ValueError('Perfil o geometría inválidos')
        for v in horas:
            if v is not None:
                if type(v) not in (float, int) or not math.isfinite(v) or not 0 <= v <= 1:
                    raise ValueError('Intensidad inválida')
                validas += 1
        for p in puntos:
            if len(p) != 2 or not all(type(x) in (int, float) for x in p) or not (-56.5 < p[0] < -55.9 and -35 < p[1] < -34.5):
                raise ValueError('Coordenadas fuera de Montevideo')
    if validas < len(tramos)*12:
        raise ValueError('Menos de la mitad de los perfiles horarios son válidos')
    return datos


def leer(ruta):
    return json.loads(Path(ruta).read_text(encoding='utf-8'))


def atomico(ruta, datos):
    ruta = Path(ruta)
    fd, temporal = tempfile.mkstemp(dir=ruta.parent, prefix='.trafico-', suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(datos, f, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temporal, ruta)
    finally:
        Path(temporal).unlink(missing_ok=True)


def vigente(carpeta, base):
    for ruta in [carpeta/'actual.json', carpeta/'anterior.json', Path(base)]:
        try:
            return validar(leer(ruta))
        except (OSError, ValueError, TypeError, KeyError):
            continue
    raise ValueError('No hay datos válidos de respaldo')


def actualizar(carpeta, base, calles, procesar, hoy=None, descarga=descargar, trabajo=None):
    hoy = hoy or date.today()
    carpeta = Path(carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    datos = vigente(carpeta, base)
    estado_path = carpeta/'estado.json'
    try:
        estado_previo = leer(estado_path)
        if estado_previo.get('periodo') == datos['periodo'] and date.fromisoformat(estado_previo['proximaComprobacion']) > hoy:
            return 'no-corresponde'
    except (OSError, ValueError, KeyError, TypeError):
        pass
    estado = dict(ultimaComprobacion=hoy.isoformat(), periodo=datos['periodo'], resultado='sin-novedades')
    try:
        with tempfile.TemporaryDirectory(prefix='.descarga-', dir=trabajo or carpeta) as temporal:
            catalogo = Path(temporal)/'catalogo.json'
            descarga(CATALOGO, catalogo, 5_000_000)
            candidato = seleccionar(leer(catalogo), hoy, datos['periodo'])
            if candidato:
                periodo, url = candidato
                archivo = Path(temporal)/'conteo.zip'
                descarga(url, archivo, 400_000_000)
                nuevos = validar(procesar(archivo, periodo, calles), periodo, datos)
                nuevos['recursoOriginal'] = url
                nuevos['actualizadoEl'] = hoy.isoformat()
                atomico(carpeta/'anterior.json', datos)
                atomico(carpeta/'actual.json', nuevos)
                datos = nuevos
                estado.update(resultado='actualizado', periodo=periodo)
        anterior_mes = (hoy.replace(day=1)-timedelta(days=1)).strftime('%Y-%m')
        siguiente = (hoy.replace(day=28)+timedelta(days=4)).replace(day=1)
        estado['proximaComprobacion'] = (siguiente if datos['periodo'] >= anterior_mes else hoy+timedelta(days=1)).isoformat()
    except Exception as error:
        estado.update(resultado='error', detalle=type(error).__name__, proximaComprobacion=(hoy+timedelta(days=1)).isoformat())
        atomico(estado_path, estado)
        raise
    atomico(estado_path, estado)
    return estado['resultado']


if __name__ == '__main__':
    carpeta, base, calles, preparador = sys.argv[1:5]
    spec = importlib.util.spec_from_file_location('preparador', preparador)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    try:
        hoy = date.fromisoformat(sys.argv[5]) if len(sys.argv) > 5 else None
        print(actualizar(carpeta, base, calles, modulo.procesar, hoy, trabajo=Path(preparador).parent))
    except Exception as error:
        print('Actualización no aplicada; se conservan los datos anteriores: '+type(error).__name__, file=sys.stderr)
        sys.exit(1)
