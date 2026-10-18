"""Preparar los segmentos del Censo 2023 publicados por el INE, sin interpolación.
Uso: python3 frontend/scripts/preparar-poblacion.py /ruta/sg_23_pg.gpkg
Requiere GDAL/ogr2ogr. El archivo se obtiene del ZIP oficial indicado en FUENTE.
"""
import datetime
import hashlib
import json
import math
import pathlib
import sqlite3
import subprocess
import sys
import tempfile

FUENTE = 'https://www5.ine.gub.uy/documents/CENSO%202023/Cartografia/Vectoriales/Unidades%20Geoestadisticas%20Censo%202023.zip'

def preparar(archivo):
    archivo = pathlib.Path(archivo).resolve()
    with sqlite3.connect(f'{archivo.as_uri()}?mode=ro', uri=True) as conexion:
        cantidad = conexion.execute("SELECT COUNT(*) FROM sg_23_pg WHERE DEPTO='01'").fetchone()[0]
    if not cantidad:
        raise ValueError('La fuente no contiene segmentos de Montevideo')
    with tempfile.TemporaryDirectory() as directorio:
        salida = pathlib.Path(directorio) / 'segmentos.geojson'
        subprocess.run(['ogr2ogr', '-f', 'GeoJSON', str(salida), str(archivo),
            '-sql', "SELECT geom, fid + 0 AS id, CODSEG AS zona, POB_TOT_23 AS poblacion, AREA_KM2 AS areaKm2 FROM sg_23_pg WHERE DEPTO='01'",
            '-t_srs', 'EPSG:4326', '-lco', 'COORDINATE_PRECISION=6'], check=True)
        datos = json.loads(salida.read_text())
    ids, codigos = set(), set()
    for f in datos['features']:
        p = f['properties']
        if (p.get('id') in ids or p.get('zona') in codigos or not p.get('zona')
            or (f.get('geometry') or {}).get('type') not in ('Polygon', 'MultiPolygon')):
            raise ValueError('Segmento duplicado o sin geometría')
        poblacion, superficie = p.get('poblacion'), p.get('areaKm2')
        if (not isinstance(poblacion, (int, float)) or not math.isfinite(poblacion) or poblacion < 0 or poblacion != int(poblacion)
            or not isinstance(superficie, (int, float)) or not math.isfinite(superficie) or superficie <= 0):
            raise ValueError('Población o superficie inválida')
        p['poblacion'] = int(poblacion)
        ids.add(p['id']); codigos.add(p['zona'])
    if len(ids) != cantidad:
        raise ValueError('Cobertura incompleta de la fuente')
    datos.pop('crs', None); datos.pop('name', None)
    datos['metadata'] = {
        'version':2, 'anio':2023, 'fuente':FUENTE, 'fuenteGeometria':FUENTE,
        'autor':'Instituto Nacional de Estadística (INE)', 'publicador':'INE',
        'archivoFuente':archivo.name, 'sha256':hashlib.sha256(archivo.read_bytes()).hexdigest(),
        'descarga':datetime.date.today().isoformat(), 'unidad':'habitantes/km²', 'unidadTerritorial':'segmento censal',
        'totalFuente':cantidad, 'totalPoblacionFuente':cantidad, 'sinGeometria':[], 'sinPoblacion':[], 'poblacionSinGeometria':[],
        'metodologia':'POB_TOT_23 dividido por AREA_KM2 del mismo segmento oficial del Censo 2023. Cartografía INE en WGS84, redondeada a 6 decimales. Sin interpolación ni proyecciones. La resolución corresponde a segmentos, no a zonas censales.',
        'atribucion':'Fuente: INE, Unidades Geoestadísticas Censo 2023, sg_23_pg.gpkg.',
        'paginaFuente':'https://www.gub.uy/instituto-nacional-estadistica/politicas-y-gestion/unidades-geostadisticas',
    }
    return datos

if __name__ == '__main__':
    datos = preparar(sys.argv[1])
    destino = pathlib.Path(__file__).parents[1] / 'src/mapa/datos/poblacion-montevideo.geojson'
    destino.write_text(json.dumps(datos, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({'segmentos':len(datos['features']), 'poblacion':sum(f['properties']['poblacion'] for f in datos['features']), 'bytes':destino.stat().st_size}))
