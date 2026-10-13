"""Convertir el Shape oficial v_sig_vias a la capa visual; requiere GDAL/ogr2ogr.

Uso: python3 frontend/scripts/preparar-calles.py /ruta/v_sig_vias.shp
No descarga datos ni modifica la base de METRONET.
"""
import json
import pathlib
import subprocess
import sys
import tempfile

PRINCIPALES = {'AVENIDA', 'BULEVAR', 'RAMBLA', 'RUTA NACIONAL'}
TIPOS = PRINCIPALES | {'CALLE', 'CAMINO'}
destino = pathlib.Path(__file__).resolve().parents[1] / 'src/mapa/datos/calles-montevideo.geojson'
with tempfile.TemporaryDirectory() as tmp:
    convertido = pathlib.Path(tmp) / 'calles.geojson'
    subprocess.run(['ogr2ogr', '-f', 'GeoJSON', '-t_srs', 'EPSG:4326', '-simplify', '2',
                    '-select', 'NOM_CALLE,TIPO,COD_NOMBRE', str(convertido), sys.argv[1],
                    '-lco', 'COORDINATE_PRECISION=6'], check=True)
    datos = json.loads(convertido.read_text())
grupos = {}
for f in datos['features']:
    p = f['properties']
    if p['TIPO'] not in TIPOS:
        continue  # No presentar vías proyectadas o peatonales como calles existentes.
    clave = (p['COD_NOMBRE'], p['NOM_CALLE'], p['TIPO'])
    geometria = f['geometry']
    if not geometria or geometria['type'] not in {'LineString', 'MultiLineString'}:
        continue
    lineas = [geometria['coordinates']] if geometria['type'] == 'LineString' else geometria['coordinates']
    validas = [linea for linea in lineas if len(linea) >= 2]
    if validas:
        grupos.setdefault(clave, []).extend(validas)
features = [{'type': 'Feature', 'properties': {'codigo': c, 'nombre': n, 'tipo': t,
             'principal': t in PRINCIPALES}, 'geometry': {'type': 'MultiLineString', 'coordinates': lineas}}
            for (c, n, t), lineas in sorted(grupos.items())]
destino.write_text(json.dumps({'type': 'FeatureCollection', 'features': features},
                             ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'{len(features)} vías, {sum(len(f["geometry"]["coordinates"]) for f in features)} tramos: {destino}')
