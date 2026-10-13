"""Preparar Censo 2011 INE desde páginas oficiales MGAP (geometría) y SIT/MVOT (población).
Uso: python3 frontend/scripts/preparar-poblacion.py /directorio/paginas
Requiere GDAL/ogr2ogr. Consultas y hashes quedan en el GeoJSON. No extrapola datos.
"""
import datetime
import hashlib
import json
import math
import pathlib
import subprocess
import sys
import tempfile

GEOMETRIA = 'https://dgrn.mgap.gub.uy/arcgis/rest/services/BASE/Administrativo/MapServer/1'
POBLACION = 'https://sit.mvot.gub.uy/arcgis/rest/services/07_EXTERNO/INDICADORES_CENSO/MapServer/6'

def clave(valores):
    return '-'.join(str(int(v)).zfill(n) for v, n in zip(valores, [2, 2, 3, 3]))

def area_km2(anillos):
    # ESRI: exteriores horarios e interiores antihorarios. Calcular en UTM 21S,
    # antes de redondear o reproyectar: los huecos restan área.
    return abs(sum(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(r,r[1:])) / 2 for r in anillos)) / 1e6

def leer_paginas(carpeta, prefijo, cantidad):
    features, ids, hashes = [], set(), []
    for archivo in sorted(pathlib.Path(carpeta).glob(f'{prefijo}-*.json'), key=lambda p:int(p.stem.split('-')[-1])):
        raw = archivo.read_bytes()
        hashes.append({'pagina': archivo.name, 'sha256': hashlib.sha256(raw).hexdigest()})
        for f in json.loads(raw)['features']:
            identificador = f['attributes']['OBJECTID']
            assert identificador not in ids, 'Página duplicada'
            ids.add(identificador); features.append(f)
    assert len(features) == cantidad, f'{prefijo}: cobertura incompleta {len(features)}/{cantidad}'
    return features, hashes

def preparar(carpeta):
    censos, hashes_p = leer_paginas(carpeta, 'poblacion', 13606)
    zonas, hashes_g = leer_paginas(carpeta, 'geometria', 13621)
    poblaciones = {}
    for f in censos:
        p = f['attributes']; assert int(p['DPTO']) == 1
        codigo = clave([p[k] for k in ['DPTO','SECC','SEGM','ZONA_1']])
        assert codigo not in poblaciones, 'Código censal duplicado'
        valor = p['P_TOT']
        assert valor is None or (isinstance(valor, int) and valor >= 0)
        poblaciones[codigo] = valor
    features, usadas, sin_poblacion = [], set(), []
    for f in zonas:
        p,g = f['attributes'],f['geometry']; assert p['DEPTO'] == 1 and g.get('rings')
        codigo = clave([p[k] for k in ['DEPTO','SECCION','SEGMENTO','ZONA']])
        codificada = p['SECCION'] > 0 and p['SEGMENTO'] > 0
        if codificada:
            assert codigo not in usadas, 'Geometría censal duplicada'
            usadas.add(codigo)
        superficie = area_km2(g['rings']); assert math.isfinite(superficie) and superficie > 0
        poblacion = poblaciones.get(codigo) if codificada else None
        if poblacion is None: sin_poblacion.append({'zona':codigo,'id':p['OBJECTID']})
        features.append({'attributes': {'id':p['OBJECTID'], 'zona':codigo, 'poblacion':poblacion, 'areaKm2':superficie}, 'geometry':g})
    # GDAL interpreta los anillos exteriores/huecos/multipolígonos de ESRI y reproyecta.
    with tempfile.TemporaryDirectory() as tmp:
        entrada, salida = pathlib.Path(tmp)/'zonas.json', pathlib.Path(tmp)/'zonas.geojson'
        entrada.write_text(json.dumps({'geometryType':'esriGeometryPolygon','spatialReference':{'wkid':32721},'features':features}))
        subprocess.run(['ogr2ogr','-f','GeoJSON','-s_srs','EPSG:32721','-t_srs','EPSG:4326',str(salida),str(entrada),'-lco','COORDINATE_PRECISION=6'],check=True)
        datos = json.loads(salida.read_text())
    for f in datos['features']:
        f['properties'].setdefault('poblacion', None)
    assert len(datos['features']) == 13621
    datos.pop('crs',None);datos.pop('name',None)
    datos['metadata'] = {'version':1,'anio':2011,'fuente':POBLACION,'fuenteGeometria':GEOMETRIA,
        'autor':'Instituto Nacional de Estadística (INE)','publicador':'MGAP y SIT / MVOT','descarga':datetime.date.today().isoformat(),
        'unidad':'habitantes/km²','totalFuente':len(zonas),'totalPoblacionFuente':len(censos),'sinGeometria':[],
        'poblacionSinGeometria':sorted(set(poblaciones)-usadas),'sinPoblacion':sin_poblacion,
        'metodologia':'Unión exacta por departamento/sección/segmento/zona del Censo 2011. P_TOT dividido por área de polígonos oficiales calculada en UTM 21S, descontando huecos, antes de reproyectar a WGS84 y redondear a 6 decimales. Sin interpolación.',
        'licencia':'Cartografía INE: uso libre citando al INE, según metadatos MGAP. Población: datos abiertos SIT/MVOT, atribución INE.',
        'metadatosGeometria':'https://dgrn.mgap.gub.uy/Metadatos/ine_zonas_11_metadatos.pdf',
        'declaracionDatosAbiertos':'https://www.gub.uy/ministerio-vivienda-ordenamiento-territorial/tramites-y-servicios/servicios/sistema-informacion-territorial',
        'consultas':{'geometria':"DEPTO=1; outFields=*; returnGeometry=true; outSR=32721; orderByFields=OBJECTID; resultRecordCount=1000; f=json",'poblacion':"DPTO='01'; outFields=*; returnGeometry=false; orderByFields=OBJECTID; resultRecordCount=2000; f=json"},
        'paginas':hashes_g+hashes_p}
    return datos

if __name__ == '__main__':
    datos = preparar(sys.argv[1])
    destino = pathlib.Path(__file__).parents[1]/'src/mapa/datos/poblacion-montevideo.geojson'
    destino.write_text(json.dumps(datos,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps({'zonas':len(datos['features']),'sinPoblacion':len(datos['metadata']['sinPoblacion']),'poblacionSinGeometria':len(datos['metadata']['poblacionSinGeometria']),'bytes':destino.stat().st_size}))
