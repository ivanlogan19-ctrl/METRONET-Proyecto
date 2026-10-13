import importlib.util
import sys
sys.dont_write_bytecode = True
import unittest
import tempfile
import csv
import io
import json
from zipfile import ZipFile
from pathlib import Path
spec = importlib.util.spec_from_file_location('preparar', Path(__file__).with_name('preparar-desplazamientos.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class PreparacionTest(unittest.TestCase):
    def test_horas(self):
        for entrada, esperado in [('4',4),('8,30',8),('23,59',23),('24,15',0),('27,59',3),('28',4),('88,88',None),('99,99',None),('',None),('8,75',None),('NaN',None)]:
            self.assertEqual(m.hora(entrada),esperado,entrada)
    def test_codigos(self):
        self.assertEqual(m.segmento('108004'),'0108004')
        self.assertIsNone(m.segmento(''))
    def test_agregacion_sin_inventar_datos(self):
        with tempfile.TemporaryDirectory() as carpeta:
            base = Path(carpeta)
            poligono = {'type':'Polygon','coordinates':[[[-56.2,-34.9],[-56.1,-34.9],[-56.1,-34.8],[-56.2,-34.8],[-56.2,-34.9]]]}
            geo = {'features':[{'properties':{'zona':c,'areaKm2':1},'geometry':poligono} for c in ['01-01-001-001','01-01-002-001']]}
            (base/'geo.json').write_text(json.dumps(geo))
            salida = io.StringIO(); escritor = csv.writer(salida,delimiter=';')
            escritor.writerow(['VF5','codsegorigen','codsegproposito','wcal0'])
            escritor.writerows([['8,30','101001','101002','10,5'],['8,45','101001','101002','20'],
                ['24,15','101002','101001','5'],['88,88','101001','101002','10'],
                ['8','301001','101002','10'],['8','101001','101001','10'],['8','101001','101002','-1']])
            with ZipFile(base/'eod.zip','w') as z: z.writestr('EOD2016/Base Viajes.csv',salida.getvalue())
            d=m.preparar(base/'eod.zip',base/'geo.json')
            self.assertEqual(d['metadata']['incluidos'],3)
            self.assertEqual(d['metadata']['totalRegistros'],7)
            self.assertEqual(d['metadata']['totalEstimado'],35.5)
            self.assertEqual(d['flujos'],[
                {'hora':0,'origen':'0101002','destino':'0101001','viajes':5.0,'muestra':1},
                {'hora':8,'origen':'0101001','destino':'0101002','viajes':30.5,'muestra':2}])
            self.assertEqual(set(d['zonas']),{'0101001','0101002'})
    def test_huecos(self):
        exterior=[[0,0],[10,0],[10,10],[0,10],[0,0]]
        hueco=[[2,2],[8,2],[8,8],[2,8],[2,2]]
        x,y=m.punto_interior([exterior,hueco])
        self.assertTrue(0<x<10 and 0<y<10)
        self.assertFalse(2<x<8 and 2<y<8)

if __name__=='__main__': unittest.main()
