# Cierre de interfaz, resultados y publicación — 8 de octubre de 2026

## Estado y alcance

- **DEFINIDO:** Documento METRONET relaciona puntaje y cumplimiento de criterios. La arquitectura cliente-servidor y el modelo de datos se conservan.
- **IMPLEMENTADO:** las condiciones obligatorias pesan igual; completar un nivel exige satisfacerlas todas y obtiene 100 puntos. No se activaron penalizaciones ni un mínimo diferente de aprobación.
- **PROPUESTO, no adoptado:** el usuario solicitó definir descuentos y un mínimo. La propuesta para revisar está fuera de Git, en `.local/propuestas/reglas-puntuacion.md`; requiere el proceso formal de AGENTS.md. No se debe confundir esa propuesta con la página de reglas vigentes.

Esta publicación incluye el recorrido integral aprobado que estaba pendiente de commit, sus pruebas y los ajustes de interfaz posteriores. El análisis anterior permanece en `recorrido-integral-2026-10-08.md` como evidencia de aquella revisión.

## Cambios de interfaz

- Ver por metro tiene separación respecto del encabezado y una ficha con nivel, Metro, línea, UV aplicada y duración aplicada (UT u horas según la versión del nivel).
- La numeración visible de los Metros pertenece a la red y comienza en 1; no usa el ID global de PostgreSQL. Una red nueva vuelve a Línea 01 y Metro 1. No se reinician secuencias de BD ni se renombran líneas guardadas.
- Valores numéricos centrados, sin flechas nativas; se conservan ±, teclado y validación.
- Iniciar/Reanudar verde, Detener rojo y Reiniciar amarillo; los controles deshabilitados conservan la apariencia inactiva global.
- Tutorial: Omitir rojo, Siguiente verde y otras acciones amarillas. Encabezados sin barra azul, sin alterar el avance práctico ni la campaña.
- Campos de formulario con fuente legible y distinción entre mayúsculas y minúsculas.
- Página Reglas accesible desde navegación desktop/móvil, protegida por sesión e integrada al contenedor y al audio persistente.
- Ventana de resultado anterior a la animación: puntos del servidor, máximo, diferencia/ausencia de descuentos y récord cuando hay evidencia. Continuar inicia la animación; Escape o navegación cancelan limpiamente.
- Se retira el puntaje del nivel de la animación. El resumen final de campaña conserva su total y ranking. No se inventan motivos de penalización; esos motivos aún no existen en las reglas activas.
- Se elimina la referencia obsoleta a «pistas» de la explicación de puntuación. El tutorial no descuenta puntos.

## Reutilización y capas

Se reutilizan los tokens success/danger/warning/tutorial, botones retro, sesión, navegación, contenedor persistente, evaluación backend, transición de victoria y el modelo existente. Las nuevas piezas de presentación son `reglas.html`, `reglas.js`, `reglas.css`, `PantallaResultadoNivel.js` y `resultado-nivel.css`.

La publicación previa del recorrido incorpora Services, un runner explícitamente desactivado en el arranque normal, el catálogo compartido y metadatos aditivos del DTO de escenarios (relato, campaña y versión del recorrido). Los Controllers y los endpoints no se reemplazan. El único ajuste adicional de PuntuacionService en esta revisión es el texto de explicación.

**Base de datos:** sin tablas, columnas ni migraciones nuevas. Las pruebas completas se ejecutaron en PostgreSQL temporal, que se eliminó al terminar. No se reinició la campaña local ni se borraron datos de usuarios.

## Verificación fresca

| Comprobación | Resultado |
| --- | --- |
| Backend completo, PostgreSQL temporal y E2E habilitado | 245 pruebas, 0 fallos, 0 errores, 0 omisiones; salida 0; 7 min 22 s |
| Campaña real Chrome + Spring + PostgreSQL | 10 niveles y acceso final a Modo Libre; 11 comprobaciones, 0 fallos; construcción/guardado/ejecución mediante interfaz |
| Ajustes de controles, tutorial, nombres, motor, Reglas y resultado | 39 pruebas, 0 fallos, 0 omisiones; salida 0 |
| Navegación persistente, audio, editor, POI y recorrido | 96 pruebas, 0 fallos, 0 omisiones; salida 0 |
| Regresión de cámara, viewport, tutorial, puntuación y victoria | 127 casos: 125 correctos en la pasada inicial; 2 pruebas de campaña quedaron desactualizadas por la nueva ventana. Se adaptó el clic Continuar y ambas pasaron en repetición focal (2/2, salida 0). No se presenta aquella pasada inicial como salida 0. |
| Explicación de puntuación | Regresión RED: 1 fallo por la mención obsoleta; GREEN: 4/4 correctas, además de la suite backend completa |
| Arranque local y CORS sin credenciales | 3/3 correctas; origen configurado aceptado, origen ajeno rechazado; salida 0 |
| Build frontend | salida 0; 4,61 s; sin warnings de build |
| Empaquetado backend después de las pruebas | salida 0; JAR local actualizado |
| Revisión de whitespace | `git diff --check`, salida 0; se repite sobre el índice antes de cada commit |

No existe un script lint en frontend/package.json. Persisten los avisos de instrumentación dinámica Mockito/JVM de las pruebas; los rechazos de seguridad provocados son casos negativos esperados.

La revisión visual en Chrome incluyó escritorio 1440 y móvil 390; los tests operacionales cubren además 1920, 1366, 1280, 768 y 320 px. Se verificaron menú por Metro, centrado, controles semánticos, tutorial y popup de resultado. Las capturas permanecen fuera del repositorio.

Comandos relevantes, con Playwright y Chrome locales configurados:

```sh
METRONET_E2E_RECORRIDO=true METRONET_BROWSER_CHANNEL=chrome bash backend/scripts/probar-postgres.sh -DfailIfNoTests=true
npm --prefix frontend run build
node --test tests/arranque-local.test.cjs
git diff --check
```

El E2E requiere Vite de pruebas en 127.0.0.1:5198. La prueba de arranque usa `npm start` y los puertos 5173/8080. Ambos procesos iniciados para verificación fueron detenidos al terminar, para no dejar puertos ocupados.

## Límites de la comprobación

- Safari y Firefox no se ejecutaron en esta revisión.
- La continuidad de audio se comprobó mediante eventos, identidad del reproductor y currentTime; no equivale a escucha física por altavoces.
- No se probó borrar partidas ni reiniciar la cuenta real del usuario. El reinicio de numeración se comprueba sobre redes nuevas sin alterar los IDs persistidos.
- La política de penalizaciones, su desglose por motivo y el nuevo mínimo permanecen pendientes de aprobación formal y ejecución posterior.
- No se modifica el Documento METRONET académico. Se mantienen fuera del commit el DOCX de consulta, las tres vistas previas locales, credenciales, respaldos, builds y capturas.

## Archivos incluidos por bloque

### Recorrido

- `backend/pom.xml`
- `backend/src/main/java/com/metronet/backend/configuracion/PublicarRecorridoIntegral.java`
- `backend/src/main/java/com/metronet/backend/dto/EscenarioJuegoResponse.java`
- `backend/src/main/java/com/metronet/backend/service/AdministracionNivelesService.java`
- `backend/src/main/java/com/metronet/backend/service/CriterioUvUtService.java`
- `backend/src/main/java/com/metronet/backend/service/JuegoEducativoService.java`
- `backend/src/main/java/com/metronet/backend/service/PublicacionNivelService.java`
- `backend/src/main/java/com/metronet/backend/service/RecorridoIntegralService.java`
- `backend/src/test/java/com/metronet/backend/configuracion/PublicarRecorridoIntegralTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/RecorridoIntegralE2EPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/RecorridoIntegralPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/ValidacionPublicacionNivelPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/service/CoberturaRecorridoTest.java`
- `docs/auditorias/recorrido-integral-2026-10-08.md`
- `frontend/src/educacion/recorrido-integral.json`

### Interfaz

- `frontend/src/educacion/ContenidoPreparacion.js`
- `frontend/src/educacion/PanelTutorialInicial.js`
- `frontend/src/educacion/PantallaPreparacionNivel.js`
- `frontend/src/educacion/RecorridoInicial.js`
- `frontend/src/educacion/TutorialInicial.js`
- `frontend/src/educacion/TutorialSimulacion.js`
- `frontend/src/educacion/tutorial-inicial.css`
- `frontend/src/estilos/componentes.css`
- `frontend/src/estilos/tokens.css`
- `frontend/src/mapa/capas/CapaRedMetro.js`
- `frontend/src/mapa/controles/NombresRed.js`
- `frontend/src/navegacion/escenarios.js`
- `frontend/src/simulacion/EscenaSimulacion.js`
- `frontend/src/simulacion/MotorSimulacion.js`
- `frontend/src/simulacion/PanelDesempeno.js`
- `frontend/src/simulacion/simulacion.css`
- `frontend/src/simulacion/simulacion.js`
- `frontend/tests/fluidez-campana.test.cjs`
- `frontend/tests/identidad-compartida.test.cjs`
- `frontend/tests/interaccion-directa.test.cjs`
- `frontend/tests/motor-velocidad.test.cjs`
- `frontend/tests/preparacion-red.test.cjs`
- `frontend/tests/puntos-interes.test.cjs`
- `frontend/tests/recorrido-integral.test.cjs`
- `frontend/tests/seleccion-red-regresion.test.cjs`
- `frontend/tests/simulacion-operacional.test.cjs`
- `frontend/tests/tutorial-inicial.test.cjs`
- `frontend/tests/tutorial-recorrido-integral.test.cjs`
- `frontend/tests/tutorial-simulacion.test.cjs`
- `frontend/tests/tutorial-visual.test.cjs`

### Resultados

- `backend/src/main/java/com/metronet/backend/service/PuntuacionService.java`
- `backend/src/test/java/com/metronet/backend/service/PuntuacionServiceTest.java`
- `docs/auditorias/interfaz-resultados-2026-10-08.md`
- `frontend/public/iniciar-contenedor.js`
- `frontend/reglas.html`
- `frontend/src/educacion/PantallaResultadoNivel.js`
- `frontend/src/educacion/PantallaTransicionNivel.js`
- `frontend/src/educacion/TransicionNivel.js`
- `frontend/src/educacion/reglas.css`
- `frontend/src/educacion/reglas.js`
- `frontend/src/educacion/resultado-nivel.css`
- `frontend/src/educacion/victoria-nivel.css`
- `frontend/src/navegacion/ContenedorAplicacion.js`
- `frontend/src/navegacion/NavegacionAplicacion.js`
- `frontend/tests/campana-educativa.test.cjs`
- `frontend/tests/contenedor-persistente.test.cjs`
- `frontend/tests/puntuacion-ranking.test.cjs`
- `frontend/tests/recorrido-integral-e2e.test.cjs`
- `frontend/tests/reglas.test.cjs`
- `frontend/tests/resultado-nivel.test.cjs`
- `frontend/tests/victoria-nivel.test.cjs`
- `frontend/vite.config.js`

### Arranque

- `package.json`
- `tests/arranque-local.test.cjs`
