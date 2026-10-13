#!/usr/bin/env python3
"""Agrega EOD 2016 por segmentos censales y hora. No publica microdatos personales."""
import csv
import hashlib
import io
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile

FUENTE = 'https://ckan-data.montevideo.gub.uy/dataset/1a5d2b8a-7286-4d43-a07c-f9f9776c6c17/resource/f9545ab1-367c-49e5-9157-aa18eb7ce9ac/download/eod2016.zip'


def hora(valor):
    texto = valor.strip().replace(',', '.')
    try:
        n = float(texto)
    except ValueError:
        return None
    # VF5 usa horas 4..28; 24..28 son madrugada del día siguiente.
    if not math.isfinite(n) or not 4 <= n <= 28 or round((n % 1) * 100) > 59:
        return None
    return int(n) % 24


def segmento(valor):
    texto = valor.strip()
    return texto.zfill(7) if texto.isdigit() else None


def area_anillo(anillo):
    return abs(sum(a[0]*b[1] - b[0]*a[1] for a, b in zip(anillo, anillo[1:]))) / 2


def punto_interior(poligono):
    """Scanline par/impar incluye huecos; el ancla permanece dentro del polígono."""
    ys = sorted(set(p[1] for anillo in poligono for p in anillo))
    y = (ys[len(ys)//2 - 1] + ys[len(ys)//2]) / 2
    xs = []
    for anillo in poligono:
        for a, b in zip(anillo, anillo[1:]):
            if (a[1] > y) != (b[1] > y):
                xs.append(a[0] + (y-a[1]) * (b[0]-a[0]) / (b[1]-a[1]))
    xs.sort()
    pares = list(zip(xs[::2], xs[1::2]))
    if not pares:
        raise ValueError('Geometría sin interior')
    a, b = max(pares, key=lambda p: p[1]-p[0])
    return [(a+b)/2, y]


def preparar(zip_path, geometria_path):
    geografia = json.loads(Path(geometria_path).read_text())
    zonas = {}
    for f in geografia['features']:
        codigo = f['properties']['zona']
        if not codigo or len(codigo.split('-')) != 4:
            continue
        clave = ''.join(codigo.split('-')[:3])
        # Ancla en una zona del segmento: representativa, nunca domicilio encuestado.
        if clave not in zonas or (f['properties']['areaKm2'] or 0) > zonas[clave]['area']:
            coords = f['geometry']['coordinates']
            poligonos = [coords] if f['geometry']['type'] == 'Polygon' else coords
            poligono = max(poligonos, key=lambda p: area_anillo(p[0]))
            zonas[clave] = {'area': f['properties']['areaKm2'] or 0, 'coordenada': punto_interior(poligono)}
    with ZipFile(zip_path) as z:
        filas = list(csv.DictReader(io.StringIO(z.read('EOD2016/Base Viajes.csv').decode('cp1252')), delimiter=';'))
    motivos = Counter()
    grupos = defaultdict(lambda: {'viajes': 0.0, 'muestra': 0})
    for f in filas:
        h = hora(f['VF5'])
        a, b = segmento(f['codsegorigen']), segmento(f['codsegproposito'])
        try:
            peso = float(f['wcal0'].replace(',', '.'))
        except ValueError:
            peso = float('nan')
        if h is None:
            motivos['sinHoraValida'] += 1
        elif not math.isfinite(peso) or peso <= 0:
            motivos['sinPonderacionValida'] += 1
        elif a not in zonas or b not in zonas:
            motivos['fueraDeCoberturaOSinSegmento'] += 1
        elif a == b:
            motivos['dentroDelMismoSegmento'] += 1
        else:
            g = grupos[(h, a, b)]
            g['viajes'] += peso
            g['muestra'] += 1
    usados = sorted({s for _, a, b in grupos for s in (a, b)})
    flujos = [{'hora': h, 'origen': a, 'destino': b, 'viajes': round(g['viajes'], 6), 'muestra': g['muestra']}
              for (h, a, b), g in sorted(grupos.items())]
    return {'version': 1, 'anio': 2016,
            'metadata': {'fuente': FUENTE, 'licencia': 'DAG-UY',
                'sha256': hashlib.sha256(Path(zip_path).read_bytes()).hexdigest(),
                'cartografiaSha256': hashlib.sha256(Path(geometria_path).read_bytes()).hexdigest(),
                'totalRegistros': len(filas), 'incluidos': sum(g['muestra'] for g in grupos.values()),
                'excluidos': dict(motivos), 'totalEstimado': round(sum(g['viajes'] for g in grupos.values()), 6),
                'metodo': 'Suma wcal0 por segmento censal origen/destino y hora de salida. Todos los modos. Solo pares con cartografía de Montevideo. Ancla interior de la mayor zona del segmento; las curvas no son trayectos viales. Se muestran hasta 12 pares de mayor peso por hora; un punto animado no equivale a una persona.'},
            'zonas': {s: zonas[s]['coordenada'] for s in usados}, 'flujos': flujos}


if __name__ == '__main__':
    resultado = preparar(sys.argv[1], sys.argv[2])
    Path(sys.argv[3]).write_text(json.dumps(resultado, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps(resultado['metadata'], ensure_ascii=False, indent=2))
    print('Flujos:', len(resultado['flujos']), 'Segmentos:', len(resultado['zonas']))
