"""Resumen reproducible de conteos CGM; uso: preparar-trafico.py archivo.zip 2026-09.

No calcula congestión. volumen_hora tiene descripciones discrepantes entre catálogo
y metadata; se conserva su media declarada y se publica SOLO un índice relativo.
"""
import calendar
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import re
import sys
import unicodedata
import zipfile

CATALOGO = 'https://ckan.montevideo.gub.uy/dataset/conteo-vehicular-en-las-principales-avenidas-de-montevideo'
DISTANCIA_MAXIMA = 60  # Metros; no extender una medición a toda una avenida.


def resumir(filas, periodo):
    sensores, fechas = {}, set()
    revision = dict(registros=0, invalidos=0, duplicados=0)
    dias_mes = calendar.monthrange(*map(int, periodo.split('-')))[1]
    for r in filas:
        revision['registros'] += 1
        try:
            fecha = r['fecha']
            dia = int(fecha[8:10])
            h, m, s = map(int, r['hora'].split(':'))
            valor = float(r['volumen_hora'])
            punto = [float(r['longitud']), float(r['latitud'])]
            if not (fecha[:7] == periodo and 1 <= dia <= dias_mes and 0 <= h < 24
                    and 0 <= m < 60 and m % 5 == 0 and s == 0
                    and math.isfinite(valor) and valor >= 0
                    and -56.5 < punto[0] < -55.9 and -35 < punto[1] < -34.5):
                raise ValueError()
        except (ValueError, KeyError):
            revision['invalidos'] += 1
            continue
        clave = (r['cod_detector'], r['id_carril'])
        g = sensores.setdefault(clave, dict(nombre=r['dsc_avenida'].strip(),
            anterior=r['dsc_int_anterior'].strip(), siguiente=r['dsc_int_siguiente'].strip(),
            coordenada=punto, sumas=[0.0]*24, muestras=[0]*24, dias=[0]*24, vistos=0, estable=True))
        if punto != g['coordenada'] or r['dsc_avenida'].strip() != g['nombre']:
            g['estable'] = False
        bit = 1 << ((dia-1)*288 + h*12 + m//5)
        if g['vistos'] & bit:
            revision['duplicados'] += 1
            continue
        g['vistos'] |= bit
        g['sumas'][h] += valor
        g['muestras'][h] += 1
        g['dias'][h] |= 1 << dia
        fechas.add(fecha)
    revision['fechas'] = sorted(fechas)
    return sensores, revision


def normalizar(nombre):
    try: nombre = nombre.encode('latin1').decode('utf8')
    except (UnicodeError, ValueError): pass
    nombre = ''.join(c for c in unicodedata.normalize('NFD', nombre.upper()) if not unicodedata.combining(c))
    for a, b in [('LA DE HERRERA', 'LUIS ALBERTO HERRERA'), ('L A DE HERRERA', 'LUIS ALBERTO HERRERA'),
                 ('LUIS A DE HERRERA', 'LUIS ALBERTO HERRERA'), ('BV. ARTGIAS', 'ARTIGAS'),
                 ('C M RAMIREZ', 'CARLOS MARIA RAMIREZ'), ('E V HAEDO', 'EDUARDO VICTOR HAEDO'),
                 ('M HERRERA Y OBES', 'MANUEL HERRERA OBES'), ('CIRC BATLLE E', 'CIRCUNVALACION MONUMENTO BATLLE'),
                 ('CIRC BATLLE W', 'CIRCUNVALACION MONUMENTO BATLLE'), ('LIBERTADOR', 'LAVALLEJA')]:
        if nombre == a: nombre = b
    palabras = re.findall(r'[A-Z0-9]+', nombre)
    ignorar = {'AV', 'AVENIDA', 'BV', 'BULEVAR', 'CNO', 'CAMINO', 'DR', 'GRAL', 'DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'EL'}
    return set('RAMBLA' if p == 'RBLA' else p for p in palabras if p not in ignorar)


def distancia(p, linea):
    # Proyección local métrica suficiente para asociar puntos a menos de 60 m.
    sx = 111320 * math.cos(math.radians(p[1]))
    pts = [((c[0]-p[0])*sx, (c[1]-p[1])*111320) for c in linea]
    menor = math.inf
    for (x, y), (xx, yy) in zip(pts, pts[1:]):
        dx, dy = xx-x, yy-y
        t = max(0, min(1, -(x*dx+y*dy)/(dx*dx+dy*dy))) if dx or dy else 0
        menor = min(menor, math.hypot(x+t*dx, y+t*dy))
    return menor


def vincular(sensores, calles):
    candidatos = [(f['properties'], normalizar(f['properties']['nombre']), i, linea)
        for f in calles['features'] for i, linea in enumerate(f['geometry']['coordinates'])]
    grupos, excluidos = {}, []
    for (detector, carril), g in sensores.items():
        palabras = normalizar(g['nombre'])
        if not g['estable'] or 'PRUEBA' in palabras or not palabras:
            excluidos.append(dict(detector=detector, motivo='Detector inestable o de prueba'))
            continue
        opciones = [(distancia(g['coordenada'], linea), p, i, linea) for p, nombre, i, linea in candidatos
                    if palabras <= nombre]
        if not opciones or min(x[0] for x in opciones) > DISTANCIA_MAXIMA:
            excluidos.append(dict(detector=detector, nombre=g['nombre'], motivo='Sin coincidencia de nombre a 60 m'))
            continue
        d, p, i, linea = min(opciones, key=lambda x: x[0])
        clave = (p['codigo'], p['tipo'], i)
        grupo = grupos.setdefault(clave, dict(codigo=p['codigo'], nombre=p['nombre'], tipo=p['tipo'],
            indiceTramo=i, coordenadas=linea, sensores=[]))
        medias = [round(g['sumas'][h]/g['muestras'][h], 4)
                  if g['muestras'][h] >= 36 and g['dias'][h].bit_count() >= 3 else None for h in range(24)]
        grupo['sensores'].append(dict(detector=detector, carril=carril, coordenada=g['coordenada'],
            distanciaMetros=round(d, 2), desde=g['anterior'], hacia=g['siguiente'], medias=medias,
            muestras=g['muestras'], dias=[n.bit_count() for n in g['dias']]))
    for g in grupos.values():
        # Mismo conjunto de carriles en cada hora; no bajar intensidad por falta de muestras.
        medias = [sum(s['medias'][h] for s in g['sensores'])
                  if all(s['medias'][h] is not None for s in g['sensores']) else None for h in range(24)]
        maximo = max((v for v in medias if v is not None), default=0)
        g['intensidades'] = [round(v/maximo, 4) if v is not None and maximo > 0 else None for v in medias]
    return list(grupos.values()), excluidos


def procesar(archivo, periodo, archivo_calles):
    with zipfile.ZipFile(archivo) as z:
        entradas = [n for n in z.infolist() if n.filename.lower().endswith('.csv')]
        if len(entradas) != 1 or entradas[0].file_size > 2_000_000_000:
            raise ValueError('El ZIP debe contener un único CSV de hasta 2 GB')
        nombre = entradas[0].filename
        with io.TextIOWrapper(z.open(nombre), encoding='utf-8-sig') as f:
            sensores, revision = resumir(csv.DictReader(f), periodo)
    calles = json.loads(Path(archivo_calles).read_text())
    tramos, excluidos = vincular(sensores, calles)
    with Path(archivo).open('rb') as f:
        huella = hashlib.file_digest(f, 'sha256').hexdigest()
    salida = dict(version=1, periodo=periodo, fuente=CATALOGO, licencia='DAG-UY',
        sha256Original=huella,
        metodologia='Media por hora del campo volumen_hora, sumada por carriles asociados al mismo tramo y dividida por su máximo horario mensual. No mide congestión ni compara capacidad entre vías. Sin extrapolación ni separación visual por sentido. Mínimo 36 muestras y 3 días por hora y carril. Datos faltantes y perfiles sin valores positivos: sin datos.',
        umbrales=[1/3, 2/3], revision=revision, detectores=len(sensores),
        excluidos=excluidos, tramos=tramos)
    return salida


def main():
    archivo, periodo = Path(sys.argv[1]), sys.argv[2]
    raiz = Path(__file__).resolve().parents[1]
    salida = procesar(archivo, periodo, raiz/'src/mapa/datos/calles-montevideo.geojson')
    destino = raiz/'src/mapa/datos/trafico-historico.json'
    destino.write_text(json.dumps(salida, ensure_ascii=False, separators=(',', ':'))+'\n')
    print(f"{salida['detectores']} detectores, {len(salida['tramos'])} tramos asociados, {len(salida['excluidos'])} excluidos; {destino.stat().st_size} bytes")


if __name__ == '__main__': main()
