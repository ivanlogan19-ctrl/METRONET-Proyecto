"""Preparar contexto IGM y contorno exterior del mapa barrial ya utilizado.

Uso: python3 frontend/scripts/preparar-contexto-geografico.py departamentos-igm.geojson
Requiere GDAL/ogr2ogr sólo para preparar el recurso; el juego lee el GeoJSON local.
La fuente IGM es la consulta indicada en los metadatos del recurso generado.
"""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

DATOS = Path(__file__).resolve().parents[1] / 'src/mapa/datos'
FUENTE = 'https://sit.mvot.gub.uy/arcgis/rest/services/07_EXTERNO/LIMITES_ADMINISTRATIVOS/MapServer/3'


def preparar(archivo):
    departamentos = json.loads(Path(archivo).read_text())
    nombres = [f['properties']['DEPTO'] for f in departamentos['features']]
    if len(set(nombres)) != 19 or nombres.count('MONTEVIDEO') != 1:
        raise ValueError('Se requieren los 19 departamentos de la fuente IGM')
    barrios = DATOS / 'barrios_wgs84.geojson'
    with tempfile.TemporaryDirectory() as carpeta:
        contorno = Path(carpeta) / 'montevideo.geojson'
        subprocess.run(['ogr2ogr', '-f', 'GeoJSON', str(contorno), str(barrios),
            '-dialect', 'SQLite', '-sql',
            'SELECT ST_SimplifyPreserveTopology(ST_Union(geometry), 0.000005) AS geometry FROM v_sig_barrios',
            '-lco', 'COORDINATE_PRECISION=7'], check=True)
        geometria = json.loads(contorno.read_text())['features'][0]['geometry']
    if geometria['type'] != 'Polygon':
        raise ValueError('Revisar el contorno: Montevideo ya no es un polígono continuo')
    # Se resalta sólo el exterior, no las pequeñas juntas entre barrios.
    geometria['coordinates'] = [geometria['coordinates'][0]]
    for departamento in departamentos['features']:
        if departamento['properties']['DEPTO'] == 'MONTEVIDEO':
            departamento['geometry'] = geometria
            departamento['properties']['fuenteGeometria'] = barrios.name
    departamentos['fuente'] = {
        'organismo': 'Instituto Geográfico Militar (IGM), servicio MVOT', 'url': FUENTE,
        'fechaPreparacion': datetime.date.today().isoformat(),
        'consulta': {'where': '1=1', 'outFields': 'DEPTO', 'outSR': 4326,
            'maxAllowableOffset': 0.001, 'geometryPrecision': 6, 'f': 'geojson'},
        'contornoMontevideo': {'archivo': barrios.name,
            'sha256': hashlib.sha256(barrios.read_bytes()).hexdigest(),
            'metodo': 'Unión de barrios existentes; anillo exterior; tolerancia de 0.000005 grados'},
        'uso': 'Contexto visual; no modifica coordenadas guardadas ni territorio construible.',
    }
    destino = DATOS / 'departamentos-contexto.geojson'
    destino.write_text(json.dumps(departamentos, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'{destino.name}: 19 departamentos; contorno de Montevideo alineado al mapa barrial')


if __name__ == '__main__':
    preparar(sys.argv[1])
