"""Prepara copias AAC para METRONET. macOS/Core Audio + NumPy, solo herramienta local.
Uso: python preparar-musica.py /directorio/de/originales
No modifica los originales. El manifiesto registra procedencia, nivel y recortes.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import wave
import numpy as np

DESTINO = Path(__file__).resolve().parents[1] / 'public' / 'audio'
PISTAS = [
    ('Portada.mp3', 'portada', True), ('07-Zodd.mp3', 'menu', True),
    ('06-Puck.mp3', 'construccion', True), ('Educativo.mp3', 'educativo', True),
    ('Simulacion.mp3', 'simulacion', True), ('AnimacionInicio.mp3', 'welcome', False),
    ('FalsaCargaDeVictoria.mp3', 'victory', False), ('Extra.mp3', 'inicio-nivel', False),
]

def preparar(raiz):
    registros = []
    with tempfile.TemporaryDirectory(prefix='metronet-musica-') as temporal:
        for original, nombre, bucle in PISTAS:
            fuente = raiz / original
            wav = Path(temporal) / 'entrada.wav'
            subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@44100', str(fuente), str(wav)], check=True)
            with wave.open(str(wav), 'rb') as f:
                canales, sr = f.getnchannels(), f.getframerate()
                muestras = np.frombuffer(f.readframes(f.getnframes()), dtype='<i2').reshape(-1, canales).astype(np.float64) / 32768
            inicio, fin = 0, len(muestras)
            if bucle:
                # Recorta solo el silencio de los extremos; conserva pausas internas.
                bloque = int(sr * .05)
                niveles = np.sqrt(np.mean(muestras[:len(muestras)//bloque*bloque].reshape(-1, bloque, canales)**2, axis=(1,2)))
                activos = np.flatnonzero(niveles > 10**(-45/20))
                inicio = int(activos[0] * bloque)
                fin = min(len(muestras), int((activos[-1]+1)*bloque))
            elif nombre == 'inicio-nivel':
                fin = 5 * sr
            audio = muestras[inicio:fin].copy()
            if bucle:
                # Une la cola con el comienzo durante 1 s. El nuevo principio y
                # final son muestras consecutivas del cuerpo, sin silencio añadido.
                n = sr
                peso = np.linspace(0, 1, n)[:, None]
                union = audio[-n:] * (1-peso) + audio[:n] * peso
                audio = np.concatenate([union, audio[n:-n]])
            else:
                n = min(int(.15*sr), len(audio)//2)
                audio[:n] *= np.linspace(0, 1, n)[:, None]
                audio[-n:] *= np.linspace(1, 0, n)[:, None]
            rms = np.sqrt(np.mean(audio**2))
            ganancia = min(10**(-22/20)/rms, .89/np.max(np.abs(audio)))
            audio *= ganancia
            salida_wav = Path(temporal) / 'salida.wav'
            with wave.open(str(salida_wav), 'wb') as f:
                f.setnchannels(canales); f.setsampwidth(2); f.setframerate(sr)
                f.writeframes((audio*32767).astype('<i2').tobytes())
            destino = DESTINO / f'{nombre}-theme.m4a'
            subprocess.run(['afconvert','-f','m4af','-d','aac','-b','192000',str(salida_wav),str(destino)], check=True)
            registros.append({'original':original,'sha256Original':hashlib.sha256(fuente.read_bytes()).hexdigest(),
                'recurso':destino.name,'sha256Recurso':hashlib.sha256(destino.read_bytes()).hexdigest(),
                'bucle':bucle,'inicioOriginalSegundos':round(inicio/sr,3),'finOriginalSegundos':round(fin/sr,3),
                'duracionSegundos':round(len(audio)/sr,3),'rmsDbfs':round(float(20*np.log10(np.sqrt(np.mean(audio**2)))),2),
                'gananciaDb':round(float(20*np.log10(ganancia)),2),'unionBucleSegundos':1 if bucle else 0})
            print(destino.name, registros[-1]['duracionSegundos'], flush=True)
    (DESTINO / 'musica-manifiesto.json').write_text(json.dumps(registros,ensure_ascii=False,indent=2)+'\n')

if __name__ == '__main__':
    preparar(Path(sys.argv[1]))
