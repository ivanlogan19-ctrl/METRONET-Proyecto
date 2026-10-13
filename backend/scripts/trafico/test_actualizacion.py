import calendar
from copy import deepcopy
from datetime import date
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('actualizador', Path(__file__).with_name('actualizar-trafico.py'))
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)


def datos(periodo):
    n = calendar.monthrange(*map(int, periodo.split('-')))[1]
    return dict(version=1, periodo=periodo, revision=dict(fechas=[f'{periodo}-{d:02d}' for d in range(1,n+1)], registros=100, invalidos=0),
                tramos=[dict(coordenadas=[[-56.2,-34.9],[-56.19,-34.9]], intensidades=[.5]*24)])


class ActualizacionTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.raiz = Path(self.tmp.name)
        self.base = self.raiz/'base.json'
        a.atomico(self.base, datos('2026-08'))
        self.cache = self.raiz/'cache'
        self.llamadas = []
        self.catalogo = dict(success=True, result=dict(resources=[
            dict(name='Conteo - Setiembre 2026', url='https://ckan-data.montevideo.gub.uy/septiembre.zip'),
            dict(name='Conteo - Octubre 2026', url='https://ckan-data.montevideo.gub.uy/octubre.zip')]))

    def descargar(self, url, destino, limite):
        self.llamadas.append(url)
        if url == a.CATALOGO: a.atomico(destino, self.catalogo)
        else: Path(destino).write_bytes(b'zip controlado')

    def ejecutar(self, hoy=date(2026,10,13), procesar=None):
        return a.actualizar(self.cache,self.base,'calles',procesar or (lambda f,p,c: datos(p)),hoy,self.descargar)

    def test_publica_mes_cerrado_atomico_y_sin_repetir_descarga(self):
        self.assertEqual(self.ejecutar(), 'actualizado')
        self.assertEqual(a.leer(self.cache/'actual.json')['periodo'], '2026-09')
        self.assertEqual(a.leer(self.cache/'anterior.json')['periodo'], '2026-08')
        self.assertEqual(a.leer(self.cache/'estado.json')['proximaComprobacion'], '2026-11-01')
        self.assertEqual(self.ejecutar(), 'no-corresponde')
        self.assertEqual(len(self.llamadas), 2)
        self.assertEqual(self.ejecutar(date(2026,11,1)), 'actualizado')
        self.assertEqual(a.leer(self.cache/'actual.json')['periodo'], '2026-10')

    def test_fuente_caida_conserva_datos_y_reintenta_al_dia_siguiente(self):
        self.ejecutar()
        antes = (self.cache/'actual.json').read_bytes()
        def caida(*args): raise OSError('sin conexión')
        with self.assertRaises(OSError):
            a.actualizar(self.cache,self.base,'calles',None,date(2026,11,1),caida)
        self.assertEqual((self.cache/'actual.json').read_bytes(), antes)
        self.assertEqual(a.leer(self.cache/'estado.json')['proximaComprobacion'], '2026-11-02')
        self.assertEqual(self.ejecutar(date(2026,11,2)), 'actualizado')

    def test_incompleto_no_reemplaza_y_descarta_temporales(self):
        self.ejecutar()
        antes = (self.cache/'actual.json').read_bytes()
        def incompleto(f,p,c):
            d=datos(p); d['revision']['fechas'].pop(); return d
        with self.assertRaises(ValueError): self.ejecutar(date(2026,11,1),incompleto)
        self.assertEqual((self.cache/'actual.json').read_bytes(), antes)
        self.assertFalse(list(self.cache.glob('.descarga-*')))

    def test_demora_de_publicacion_solo_consulta_catalogo(self):
        self.ejecutar()
        self.catalogo['result']['resources'].pop()
        self.assertEqual(self.ejecutar(date(2026,11,1)), 'sin-novedades')
        self.assertEqual(len(self.llamadas),3)
        self.assertEqual(a.leer(self.cache/'estado.json')['proximaComprobacion'],'2026-11-02')

    def test_reinicio_recupera_backup_y_estado_ausente(self):
        self.ejecutar()
        (self.cache/'actual.json').write_text('{roto')
        self.assertEqual(a.vigente(self.cache,self.base)['periodo'],'2026-08')
        (self.cache/'estado.json').unlink()
        self.assertEqual(self.ejecutar(),'actualizado')
        self.assertEqual(a.vigente(self.cache,self.base)['periodo'],'2026-09')

    def test_validacion_cobertura_coordenadas_y_nan(self):
        for cambio in ('cobertura','geometria','nan','sin_datos'):
            d=datos('2026-09'); previo=datos('2026-08')
            if cambio=='cobertura': previo['tramos']*=3
            if cambio=='geometria': d['tramos'][0]['coordenadas'][0]=[0,0]
            if cambio=='nan': d['tramos'][0]['intensidades'][0]=float('nan')
            if cambio=='sin_datos': d['tramos'][0]['intensidades']=[None]*24
            with self.subTest(cambio=cambio), self.assertRaises(ValueError): a.validar(d,'2026-09',previo)

    def test_solo_https_oficial_incluso_redirecciones(self):
        for url in ['http://ckan-data.montevideo.gub.uy/a.zip','https://evil.test/a.zip','https://ckan-data.montevideo.gub.uy:888/a.zip','https://u:p@ckan-data.montevideo.gub.uy/a.zip']:
            with self.subTest(url=url), self.assertRaises(ValueError): a.validar_url(url)
        with self.assertRaises(ValueError):
            a.RedireccionOficial().redirect_request(None,None,302,'',{},'http://127.0.0.1/a')


if __name__ == '__main__': unittest.main()
