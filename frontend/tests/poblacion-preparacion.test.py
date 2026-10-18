import sys
sys.dont_write_bytecode = True
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('preparar', Path(__file__).parents[1] / 'scripts/preparar-poblacion.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class Preparacion(unittest.TestCase):
    def preparar(self, poblacion=100):
        with tempfile.TemporaryDirectory() as directorio:
            carpeta = Path(directorio)
            features = []
            for id, depto in enumerate(['01', '02'], 1):
                features.append({'type':'Feature', 'properties':{'DEPTO':depto,'CODSEG':depto+'01001','POB_TOT_23':poblacion,'AREA_KM2':1},
                    'geometry':{'type':'Polygon','coordinates':[[[-56,-35],[-56.01,-35],[-56.01,-35.01],[-56,-35.01],[-56,-35]]]}})
            entrada = carpeta / 'entrada.geojson'
            entrada.write_text(json.dumps({'type':'FeatureCollection','features':features}))
            gpkg = carpeta / 'sg_23_pg.gpkg'
            subprocess.run(['ogr2ogr','-f','GPKG',str(gpkg),str(entrada),'-nln','sg_23_pg'],check=True,capture_output=True)
            return m.preparar(gpkg)

    def test_filtra_montevideo_y_conserva_dato_oficial(self):
        datos = self.preparar()
        self.assertEqual(len(datos['features']), 1)
        self.assertEqual(datos['features'][0]['properties']['poblacion'], 100)
        self.assertEqual(datos['features'][0]['properties']['areaKm2'], 1)
        self.assertEqual(datos['metadata']['anio'], 2023)
        self.assertEqual(datos['metadata']['unidadTerritorial'], 'segmento censal')

    def test_rechaza_poblacion_negativa(self):
        with self.assertRaises(ValueError): self.preparar(-1)

    def test_cero_es_dato_valido(self):
        self.assertEqual(self.preparar(0)['features'][0]['properties']['poblacion'], 0)

if __name__ == '__main__': unittest.main()
