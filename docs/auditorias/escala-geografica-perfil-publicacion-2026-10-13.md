# Escala geográfica, interfaz y publicación — 13/10/2026

## DEFINIDO

El usuario confirmó formalmente y aprobó el alcance: 1 UV = 1 km por UT, 1 UT = una hora del escenario; cálculo geográfico, revisión de diez niveles, compatibilidad histórica, explicación en Administración y validación completa. Autorizó guardar todos los cambios locales y publicarlos en Git.

Esta decisión posterior sustituye la limitación de UV lógica registrada en `simulacion-territorial-2026-10-13.md`; aquella auditoría conserva su carácter histórico. La adenda del Documento METRONET hace explícita la sustitución.

## IMPLEMENTADO

- Backend y motor visual calculan el recorrido con kilómetros geográficos entre estaciones. Distancia recorrida = mínimo entre longitud de línea y UV × UT efectiva; tiempo para completarla = longitud / UV. No se estiman rutas por calles ni tiempos de parada.
- La API de simulación agrega distanciaKm por tramo y mediciones de distancia/tiempo por unidad. Las ejecuciones nuevas identifican su escala como UV_KM_UT_V3; los registros anteriores se conservan y no se comparan silenciosamente con otra escala.
- Criterios UV/UT, publicación de referencias y campaña integral revisados para kilómetros. Los diez niveles conservan cinco metas reales; niveles 1–5 sin POI y 6–10 con tres POI por nivel, distintos entre sí.
- Capas de desplazamientos históricos, fuentes centralizadas y organización de Modo Libre; reloj, capas y cobertura integrados en Simulación libre, con tutorial propio de ocho pasos.
- Perfil en tres tarjetas horizontales en escritorio, resumen compacto, acciones alineadas, fuente pixelada en todos sus controles y opción de mostrar/ocultar contraseña.
- Administración ofrece al jugador solo Fuentes del mapa y Unidades y equivalencias. Los endpoints administrativos mantienen su autorización. Equivalencias en tablas y dibujos con estilo y línea de base comunes.
- Nueva presentación del acceso a Modo Libre centrada en lo aprendido y en construir una red propia.

Capas afectadas: presentación, motor de simulación y servicios de negocio/lectura de persistencia. Sin migraciones ni cambios de esquema. Contratos REST ampliados con campos; no se crearon endpoints.

## Evidencia fresca

- Regresión completa de backend: `bash backend/scripts/probar-postgres.sh -DfailIfNoTests=true`: salida 0, BUILD SUCCESS, 339 pruebas contabilizadas, 337 aprobadas y dos suites E2E condicionales omitidas en esta ejecución general. Ambas suites E2E se ejecutaron y aprobaron por separado como se detalla abajo. Se actualizaron dos casos que todavía esperaban la escala anterior UV_H_V1.

- Campaña real: `METRONET_E2E_RECORRIDO=true ... bash backend/scripts/probar-postgres.sh -Dtest=RecorridoIntegralE2EPostgresTest`: salida 0, BUILD SUCCESS; 11 comprobaciones de navegador, diez niveles construidos, guardados, simulados y finalizados; acceso a Modo Libre. Chrome + Spring Boot + PostgreSQL temporal real.
- Modo Libre real: `METRONET_E2E_CALLES=true ... bash backend/scripts/probar-postgres.sh -Dtest=CallesModoLibreE2EPostgresTest`: salida 0, una prueba integrada aprobada. Comprueba capas, construcción, persistencia, distancias V3 y fórmula UV×UT, medianoche, pausa/reanudación, tutorial, permisos del jugador y perfil. Perfil sin scroll a 1280×720 y 1440×900; mapa/panel sin desbordes a 1280×720, 1440×1000 y 1920×1080.
- Backend enfocado: DistanciasRedServiceTest, RecorridoIntegralPostgresTest, CampanaPostgresTest y ValidacionPublicacionNivelPostgresTest: 32 aprobadas, cero fallos/errores/omisiones, salida 0.
- Motor, reloj y desplazamientos: `node --test frontend/tests/motor-velocidad.test.cjs frontend/tests/reloj-territorial.test.mjs frontend/tests/desplazamientos.test.mjs`: 19 aprobadas, cero fallos/omisiones, salida 0.
- Tutoriales de simulación en Chrome con contratos controlados: 16 aprobadas, cero fallos, salida 0. Selección/copy: una aprobada, salida 0.
- Preparación de desplazamientos en Python: cuatro aprobadas, salida 0.
- Compilación Vite correcta. DOCX: ZIP íntegro y XML válido. `git diff --check` sin errores.

## Límites y propuesta posterior

Las pruebas integradas usan PostgreSQL real aislado, no la base personal del usuario. El correo está sustituido en las pruebas. No se verificaron Safari/Firefox ni todas las dimensiones móviles. El DOCX no fue revisado visualmente en Word. No se reinició la sesión local del usuario ni se republicó su catálogo activo durante esta publicación; debe reiniciar el servidor para cargar el código Java actualizado. Los intentos antiguos mantienen su configuración histórica.

PROPUESTO, todavía no implementado: botón de regla y etiquetas de kilómetros en el editor libre. El usuario pidió una imagen previa después de publicar; esa vista no forma parte de estos cambios.

## Archivos incluidos

- `backend/src/main/java/com/metronet/backend/dto/DesempenoNivelResponse.java`
- `backend/src/main/java/com/metronet/backend/dto/TramoSimulacionResponse.java`
- `backend/src/main/java/com/metronet/backend/service/AdministracionUvUtService.java`
- `backend/src/main/java/com/metronet/backend/service/CriterioUvUtService.java`
- `backend/src/main/java/com/metronet/backend/service/DistanciasRedService.java`
- `backend/src/main/java/com/metronet/backend/service/PuntuacionService.java`
- `backend/src/main/java/com/metronet/backend/service/RecorridoIntegralService.java`
- `backend/src/main/java/com/metronet/backend/service/RegistroSimulacionDidactica.java`
- `backend/src/main/java/com/metronet/backend/service/SimulacionService.java`
- `backend/src/test/java/com/metronet/backend/configuracion/CallesModoLibreE2EPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/CampanaPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/EscalaSimulacionPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/RecorridoIntegralPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/ValidacionPublicacionNivelPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/service/DistanciasRedServiceTest.java`
- `docs/Documento METRONET.docx`
- `docs/auditorias/desplazamientos-2026-10-13.md`
- `docs/auditorias/escala-geografica-perfil-publicacion-2026-10-13.md`
- `docs/auditorias/simulacion-territorial-2026-10-13.md`
- `frontend/admin.html`
- `frontend/perfil.html`
- `frontend/public/assets/icono-actividad-caja-herramientas-v3.svg`
- `frontend/public/assets/icono-experiencia-tren-v2.svg`
- `frontend/public/assets/icono-mantenimiento-engranaje-v2.svg`
- `frontend/public/assets/icono-montevideo-admin.svg`
- `frontend/public/assets/icono-unidades-admin.svg`
- `frontend/public/assets/pare-admin.svg`
- `frontend/public/assets/usuario-busto-admin.svg`
- `frontend/reglas.html`
- `frontend/scripts/preparar-desplazamientos.py`
- `frontend/scripts/test_preparar_desplazamientos.py`
- `frontend/src/administracion/AdministracionUvUt.js`
- `frontend/src/administracion/administracion.css`
- `frontend/src/administracion/administracion.js`
- `frontend/src/educacion/OfertaTutorial.js`
- `frontend/src/educacion/PanelTutorialInicial.js`
- `frontend/src/educacion/TutorialCalles.js`
- `frontend/src/educacion/TutorialSimulacion.js`
- `frontend/src/educacion/glosario/Conceptos.js`
- `frontend/src/educacion/recorrido-integral.json`
- `frontend/src/educacion/reglas.js`
- `frontend/src/educacion/tutorial-inicial.css`
- `frontend/src/interfaz/PictogramasMapa.js`
- `frontend/src/mapa/FuentesMapa.js`
- `frontend/src/mapa/MapaScene.js`
- `frontend/src/mapa/capas/CapaBarrios.js`
- `frontend/src/mapa/capas/CapaCalles.js`
- `frontend/src/mapa/capas/CapaDesplazamientos.js`
- `frontend/src/mapa/capas/CapaTrafico.js`
- `frontend/src/mapa/controles/EditorRedMetro.js`
- `frontend/src/mapa/controles/PanelCalles.js`
- `frontend/src/mapa/controles/PanelDesplazamientos.js`
- `frontend/src/mapa/controles/PanelPoblacion.js`
- `frontend/src/mapa/controles/PanelTrafico.js`
- `frontend/src/mapa/datos/desplazamientos-historicos.json`
- `frontend/src/mapa/desplazamientos/ModeloDesplazamientos.mjs`
- `frontend/src/mapa/desplazamientos/RelojCapas.mjs`
- `frontend/src/mapa/estilos/calles.css`
- `frontend/src/mapa/estilos/editor-red.css`
- `frontend/src/mapa/estilos/fuentes-mapa.css`
- `frontend/src/navegacion/NavegacionAplicacion.js`
- `frontend/src/navegacion/escenarios.js`
- `frontend/src/perfil/perfil.css`
- `frontend/src/simulacion/CapasSimulacionLibre.js`
- `frontend/src/simulacion/EscalaSimulacion.js`
- `frontend/src/simulacion/EscenaSimulacion.js`
- `frontend/src/simulacion/MotorSimulacion.js`
- `frontend/src/simulacion/RelojTerritorial.mjs`
- `frontend/src/simulacion/capas-simulacion.css`
- `frontend/src/simulacion/simulacion.js`
- `frontend/tests/calles-modo-libre-e2e.test.cjs`
- `frontend/tests/desplazamientos.test.mjs`
- `frontend/tests/motor-velocidad.test.cjs`
- `frontend/tests/reloj-territorial.test.mjs`
- `frontend/tests/seleccion-campana-actual.test.cjs`
- `frontend/tests/tutorial-simulacion.test.cjs`
