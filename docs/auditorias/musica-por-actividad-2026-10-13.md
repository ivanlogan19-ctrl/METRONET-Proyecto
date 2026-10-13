# Música por actividad — 13 de octubre de 2026

## Estado y alcance

- **DEFINIDO:** se conservan la arquitectura cliente-servidor, el reproductor persistente, los controles de volumen y silencio y las reglas del juego. No se modifica el Documento METRONET.
- **IMPLEMENTADO:** reparto musical aprobado por el usuario mediante «implementalo», copias preparadas para reproducción web y atenuación durante la lectura.
- **PROPUESTO:** una escucha comparativa del resultado para ajustar la elección artística o los puntos musicales de empalme. El análisis de señal no sustituye esa escucha.

## Reparto aplicado

| Pantalla o momento | Original | Recurso preparado |
|---|---|---|
| Acceso, registro y recuperación | Portada.mp3 | portada-theme.m4a |
| Bienvenida del tren | AnimacionInicio.mp3 | welcome-theme.m4a |
| Inicio, niveles, diseños, ranking, perfil y Administración | 07-Zodd.mp3 | menu-theme.m4a |
| Construcción de niveles y Modo Libre | 06-Puck.mp3 | construccion-theme.m4a |
| Aprendizaje, tarjetas y Reglas | Educativo.mp3 | educativo-theme.m4a |
| Simulación | Simulacion.mp3 | simulacion-theme.m4a |
| Entrada al nivel | Primeros cinco segundos de Extra.mp3 | inicio-nivel-theme.m4a |
| Victoria | FalsaCargaDeVictoria.mp3 | victory-theme.m4a |

Guts, Wyald, Casca y Menus quedan en reserva. Los doce originales del usuario no se modificaron; se comprobaron sus hashes después del trabajo.

## Tratamiento y comportamiento

- Copias AAC de 192 kbps, preparadas con Core Audio de macOS; sin nueva dependencia de ejecución del juego. La herramienta local de preparación requiere NumPy.
- Nivel RMS objetivo de −22 dBFS y protección de picos. Es una normalización técnica, no una medición perceptual LUFS.
- Las cinco pistas de fondo tienen recorte del silencio en los extremos y unión entre cola y comienzo de un segundo. Las pausas internas se conservan. La calidad musical de esos empalmes requiere escucha.
- Transiciones de 800 ms entre contextos; se conserva la posición de cada fondo y la preferencia de volumen del usuario.
- Los diálogos de lectura y la guía rápida reducen el volumen efectivo a la mitad. Cerrar el último diálogo o abandonar la vista libera la atenuación. Las animaciones de entrada y victoria no activan esta reducción.
- Entrada de cinco segundos, más la identificación existente de un segundo. Se mantienen los diez segundos visuales de bienvenida y once de victoria, sin obligar a escuchar el archivo completo. Un fallo de audio no bloquea el acceso.
- Se sustituyen siete MP3 internos por ocho M4A. El manifiesto registra los hashes, recortes, duración y ganancia de cada copia.

## Archivos afectados

Todos los paths de esta lista son relativos a la raíz del repositorio.

- `frontend/public/audio/`: ocho recursos `*-theme.m4a`, `musica-manifiesto.json` y retirada de los siete MP3 sustituidos.
- `frontend/scripts/preparar-musica.py`: preparación reproducible de las copias.
- `frontend/src/audio/ConfiguracionAudio.js`, `GestorMusica.js`, `ClienteMusicaPersistente.js`, `ReanudacionTemprana.js` y nuevo `AtenuacionLectura.js`: asignación, mezcla y lectura.
- `frontend/src/educacion/ConfiguracionTransicion.js` y `PresentacionMusicalNivel.js`: duración diferenciada de entrada.
- `frontend/reglas.html` y `frontend/src/navegacion/NavegacionAplicacion.js`: contexto educativo en Reglas.
- Pruebas en `frontend/tests/`: `musica-nueva-asignacion`, `musica-contextual`, `musica-autenticacion`, `musica-bienvenida`, `musica-inicio-nivel`, `musica-victoria`, `continuidad-musical`, `duracion-musical-nivel`, `contenedor-persistente`, `reanudacion-temprana`, `identificacion-nivel`, `consultas-concurrentes`, `estabilidad-mapa` y `calles-modo-libre-e2e` (todas `.test.cjs`).
- Este informe.

Las pruebas antiguas del contenedor que esperaban denegar todo acceso de un jugador a Administración se actualizaron al comportamiento previamente solicitado: acceso únicamente a Fuentes y Unidades, sin tabla de usuarios ni solicitudes administrativas. No se cambió la implementación de permisos en este trabajo.

## Evidencia de validación

Chrome local, frontend servido en `http://127.0.0.1:5198`. Las suites de componentes interceptan REST; la prueba PostgreSQL indicada abajo usa servidor y base reales.

| Comprobación | Resultado observado |
|---|---|
| Decodificación de las ocho copias AAC, duración, hash, RMS y picos | 8/8 válidas, salida 0; RMS entre −22,01 y −22,00 dBFS y sin saturación digital |
| Integridad final de originales y manifiesto | 12 originales intactos, 8 recursos coincidentes, salida 0 |
| `npm --prefix frontend run build` final | Salida 0, compilación completada |
| Primera ejecución: continuidad, entrada y nueva asignación | 16/18; dos expectativas de entrada ajustadas y aprobadas después |
| Segunda ejecución: duración, autenticación, contexto, entrada y nueva asignación | 63/65; dos expectativas sobre mezcla y oferta de tutorial ajustadas y aprobadas después |
| Contenedor, bienvenida, contexto y victoria | 62/70; los ocho casos fallidos se corrigieron en las pruebas y se volvieron a ejecutar de forma dirigida |
| Reejecución de editor/simulador, salida, intro y outro | 3/5; editor/simulador, salida y outro aprobados. Las dos intros se corrigieron para permitir el fin natural del fragmento y aprobaron en la siguiente ejecución |
| Comprobaciones complementarias de carga, mapa, identificación, menús e intros | 12/13; las dos intros aprobadas. La carga temprana se ajustó al volumen reducido del tutorial y se volvió a ejecutar |
| Navegación informativa del jugador y continuidad | 3/3, salida 0 |
| Reejecución de carga temprana de simulación | 1/1, salida 0 |
| Flujo `CallesModoLibreE2EPostgresTest` | 1/1, sin errores, fallos ni omisiones; salida 0, `BUILD SUCCESS` a las 15:16:51 −03:00 |

El flujo real utilizó Spring Boot, PostgreSQL temporal aislado y Chrome: construir, guardar, recuperar, abrir simulación, capas/reloj y comprobar reproducción efectiva de Puck en edición y Simulacion en simulación. No se alteró la base de datos del usuario. Las fuentes cartográficas de prueba incluyen fallos controlados propios de esa suite; esto no equivale a validar disponibilidad permanente de proveedores externos.

Comando de integración:

```sh
METRONET_E2E_CALLES=true METRONET_PLAYWRIGHT_PATH=<playwright-local> METRONET_BROWSER_CHANNEL=chrome \
  bash backend/scripts/probar-postgres.sh -Dtest=CallesModoLibreE2EPostgresTest -DfailIfNoTests=true
```

Las pruebas del navegador se ejecutaron con `node --test --test-concurrency=1`, `METRONET_URL_PRUEBAS=http://127.0.0.1:5198`, Playwright local y Chrome. Las reejecuciones dirigidas emplearon `--test-name-pattern` para repetir los casos corregidos; no se presenta una ejecución inicial con fallos como una suite completamente aprobada.

## Límites y pendientes

- No se ejecutó otra campaña completa de diez niveles ni la suite total del repositorio: se verificó el alcance musical y una integración real de Modo Libre.
- No se verificaron Safari ni Firefox, ni salida audible en altavoces/auriculares, ni se certifica la selección artística o el empalme mediante escucha.
- Sin modificaciones de backend, entidades, esquema PostgreSQL, endpoints, contratos ni documento académico.
- Cambios guardados localmente. Este trabajo no crea commit ni publica en Git por sí mismo.
