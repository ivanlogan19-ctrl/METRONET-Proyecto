# Simulación territorial de Modo Libre — 13/10/2026

## DEFINIDO

Cambio formal confirmado y ejecución aprobada por el usuario: integrar capas y cobertura en Simulación de Modo Libre, con reloj sincronizado y 1 UT = una hora del escenario. Mantener pestañas y controles existentes. El ajuste posterior solicita reducir botones y menús hasta que todo entre en el panel.

La adenda del Documento METRONET conserva la trazabilidad del alcance anterior: el reloj independiente sigue perteneciendo al editor; en Simulación libre el motor es la fuente única de tiempo. UV no se convierte en km/h. La población censal no varía con la hora.

## IMPLEMENTADO

- `frontend/src/simulacion/CapasSimulacionLibre.js`: coordinación de capas existentes, horario inicial, actual y final, progreso, opacidad y cobertura de 500 m en línea recta. Preferencias locales por diseño, inicialmente desactivadas. Fallos de capas no bloquean simular.
- `frontend/src/simulacion/RelojTerritorial.mjs`: reloj derivado de UT, cambio de día y geometría de cobertura geográfica.
- `frontend/src/simulacion/EscenaSimulacion.js`: ciclo de vida, sincronización y redibujado exclusivos de LIBRE/EDICION_LIBRE.
- `frontend/src/simulacion/capas-simulacion.css`: botones de parámetros de 30–32 px, iconos de 16 px, menús de 32 px, encabezados compactos y separación de 6 px. Por la aclaración posterior del usuario, el cuadro completo de Acciones ocupa 72 px en escritorio y Capas del mapa recibe espacio flexible adicional; sus botones conservan 34 × 32 px. Conserva los controles anteriores y la navegación.
- `frontend/src/interfaz/PictogramasMapa.js`: icono adicional para cobertura.
- `frontend/tests/reloj-territorial.test.mjs`, `frontend/tests/motor-velocidad.test.cjs` y `frontend/tests/calles-modo-libre-e2e.test.cjs`: comprobaciones del reloj y del recorrido real.
- `docs/Documento METRONET.docx`: adenda aprobada, agregada sin sustituir silenciosamente las reglas anteriores.

Capas afectadas: presentación y coordinación de simulación del frontend. No hay cambios de esquema, migraciones, endpoints ni contratos REST de producción. UT utiliza el guardado existente.

## Evidencia

- `node --test frontend/tests/reloj-territorial.test.mjs frontend/tests/motor-velocidad.test.cjs`: 13 aprobadas, 0 fallos, 0 omitidas, salida 0. Incluye UT distintas por unidad, pausa, reinicio, independencia de UV, medianoche y radio geográfico de 500 m.
- `METRONET_E2E_CALLES=true ... bash backend/scripts/probar-postgres.sh -Dtest=CallesModoLibreE2EPostgresTest`: Chrome + Spring Boot + PostgreSQL 17.10; 1 prueba integrada aprobada, 0 fallos/errores/omitidas, salida 0. Servicios y persistencia reales; el envío de correo está sustituido en la prueba.
- El recorrido real crea/edita/guarda la red, recupera sus elementos del servidor, activa las cinco capas, guarda 3 UT, inicia a las 23:30, cruza medianoche, pausa/reanuda/detiene y recupera preferencias locales al recargar. Comprueba también fuentes históricas y continuidad del editor.
- Geometría real en 1280×720, 1440×1000 y 1920×1080: ningún control fuera del panel; secciones separadas; mapa/panel coinciden en altura con diferencia de 1 px por su borde; documento sin desplazamiento vertical en esos tamaños.
- Capturas: `/tmp/metronet-simulacion-libre-1280.png`, `/tmp/metronet-simulacion-libre-1440.png`, `/tmp/metronet-simulacion-libre-1920.png`.
- `METRONET_URL_PRUEBAS=http://127.0.0.1:5198 ... node --test frontend/tests/tutorial-simulacion.test.cjs`: 16 aprobadas, 0 fallos/omitidas, salida 0. Regresión en Chrome con contratos simulados; complementa la prueba real anterior.
- `npm --prefix frontend run build`: correcto, salida 0.
- `git diff --check`: correcto, salida 0. Documento DOCX: ZIP íntegro y XML válido.

## Límites

La cobertura es ilustrativa: no calcula caminabilidad, pasajeros atendidos ni reducción de congestión. Preferencias de capas/horario no se almacenan como resultado de ejecución en PostgreSQL. No se verificaron Safari/Firefox ni todos los tamaños móviles. El documento se validó como XML/ZIP; no se revisó su paginación en Word. No se publicaron commits ni cambios remotos en esta etapa.
