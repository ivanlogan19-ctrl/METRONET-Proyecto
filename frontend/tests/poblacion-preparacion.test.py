import sys
sys.dont_write_bytecode = True
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('preparar',Path(__file__).parents[1]/'scripts/preparar-poblacion.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Preparacion(unittest.TestCase):
    def test_area_descuenta_hueco_en_metros(self):
        exterior=[[0,0],[0,1000],[1000,1000],[1000,0],[0,0]]
        hueco=[[100,100],[200,100],[200,200],[100,200],[100,100]]
        self.assertAlmostEqual(m.area_km2([exterior,hueco]),.99)
    def test_codigo_numerico_y_cadena_coinciden(self):
        self.assertEqual(m.clave([1,8,4,3]),m.clave(['01','08','004','003']))
        self.assertEqual(m.clave([1,8,4,3]),'01-08-004-003')
    def test_no_admite_cobertura_parcial(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(AssertionError):m.leer_paginas(d,'poblacion',13606)
if __name__=='__main__':unittest.main()
