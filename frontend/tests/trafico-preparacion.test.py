import importlib.util
import sys
from pathlib import Path
import unittest

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('trafico', Path(__file__).resolve().parents[1]/'scripts/preparar-trafico.py')
trafico = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trafico)


class PreparacionTest(unittest.TestCase):
    def test_faltantes_invalidos_y_duplicados_no_son_cero(self):
        r = dict(cod_detector='1', id_carril='1', fecha='2026-09-01', hora='08:00:00', volumen_hora='12',
                 latitud='-34.9', longitud='-56.2', dsc_avenida='Av Italia', dsc_int_anterior='A', dsc_int_siguiente='B')
        sensores, revision = trafico.resumir([r, r, dict(r, volumen_hora='NaN'), dict(r, hora='24:00:00')], '2026-09')
        self.assertEqual(revision['duplicados'], 1)
        self.assertEqual(revision['invalidos'], 2)
        g = sensores[('1', '1')]
        self.assertEqual(g['muestras'][8], 1)
        self.assertEqual(g['sumas'][8], 12)

    def test_no_asocia_calle_distinta_o_lejana(self):
        g = dict(nombre='Av Italia', estable=True, coordenada=[-56.2, -34.9], anterior='A', siguiente='B',
                 muestras=[360]*24, sumas=[3600]*24, dias=[14]*24)
        def calle(nombre, lon):
            return dict(properties=dict(nombre=nombre, codigo=1, tipo='AVENIDA'),
                        geometry=dict(coordinates=[[[lon,-34.9],[lon,-34.901]]]))
        tramos, descartes = trafico.vincular({('1','1'):g}, {'features':[calle('AV BRASIL', -56.2), calle('AV ITALIA',-56.3)]})
        self.assertEqual(tramos, [])
        self.assertEqual(len(descartes), 1)
        tramos, _ = trafico.vincular({('1','1'):g}, {'features':[calle('AV ITALIA',-56.2)]})
        self.assertEqual(tramos[0]['intensidades'], [1]*24)


if __name__ == '__main__': unittest.main()
