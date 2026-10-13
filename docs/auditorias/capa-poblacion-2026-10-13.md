# Capa de densidad de población — 13/10/2026

## DEFINIDO y autorización

El usuario confirmó formalmente incorporar en Modo Libre una capa de densidad de población con datos oficiales, controles de iconos y construcción por encima. Aprobó después el análisis de impacto: polígonos censales, residentes/km², cinco bandas violetas, transparencia independiente, fuente y año, tutorial, pruebas con navegador/servidor/PostgreSQL. Sin tablas nuevas ni nuevos contratos REST. La densidad residencial no es movilidad horaria y no cambia con el reloj del tráfico. No se autorizó una actualización mensual de población.

## IMPLEMENTADO parcialmente

- `CapaPoblacion.js`: carga diferida, validación completa, triangulación de polígonos y huecos con Phaser, cámara/proyección compartida, capa pasiva a profundidad 0.5; límites de barrios a profundidad 1, calles 2, tráfico 2.5 y red por encima. Opacidad independiente y limpieza al salir.
- `ModeloPoblacion.mjs`: cálculo población/área oficial, cinco bandas hasta 1.000/5.000/10.000/20.000 habitantes/km² y superiores. Gris para datos inválidos o faltantes, distinto de cero residentes.
- `PanelPoblacion.js`, `PanelCalles.js`, `calles.css`, `PictogramasMapa.js`: icono, opacidad, leyenda, año e información con cierre exterior/Escape.
- Integración en `MapaScene.js`, `EditorRedMetro.js`, `CapaBarrios.js`; tutorial y guía en `TutorialCalles.js` y `PanelTutorialInicial.js`.
- `preparar-poblacion.py`: prepara páginas oficiales, conserva población/área/geometría, registra hashes, comprueba completitud y rechaza fuentes sin geometría.
- `poblacion-montevideo.geojson` contiene un manifiesto **no_disponible**, no datos inventados ni una capa censal vacía presentada como válida. La interfaz explica la ausencia sin bloquear la red.

## Impedimento verificado en la fuente

Fuente inicialmente prevista: INE mediante SIT/MVOT, `https://sit.mvot.gub.uy/arcgis/rest/services/07_EXTERNO/INDICADORES_CENSO/MapServer/5` (Zonas 2023).

Consulta `DEPTO='01'` devuelve 13.648 registros. Se descargaron siete páginas de atributos. Todos contienen geometría nula. Se repitió con `returnGeometry=true`, GeoJSON y JSON de ArcGIS; también se consultó un objeto individual (266). No se obtuvo polígono. La consulta de Zonas 2011 en el mismo servicio también devuelve geometría nula en la muestra. No se atribuye este fallo técnico a una causa no demostrada.

De forma independiente, el INE informa que el marco 2023 está en revisión metodológica y territorial y volverá a publicarse al finalizarla:
`https://www.gub.uy/instituto-nacional-estadistica/politicas-y-gestion/cartografia-estadistica` (14/05/2026; consultado 13/10/2026).

Se consultó al usuario si prefiere cartografía oficial disponible de otro año claramente identificado o esperar a la republicación de 2023. **No se incorporó otro año sin resolver esa elección.**

## PROPUESTO / pendiente

Obtener una fuente censal válida y utilizable, revisar su cobertura y condiciones, preparar datos reales y ejecutar la rama completa de aceptación de colores, geometría, alineación y rendimiento. La infraestructura de interfaz no equivale a una capa poblacional operativa. No se presenta un mockup como prueba de funcionamiento.

## Validación

- `node --test frontend/tests/poblacion-datos.test.cjs frontend/tests/calles-datos.test.cjs frontend/tests/trafico-historico.test.cjs`: 6 pruebas aprobadas, 0 fallos, salida 0.
- `npm --prefix frontend run build`: aprobado, salida 0.
- `METRONET_E2E_CALLES=true METRONET_PLAYWRIGHT_PATH=/Users/loganiglesias/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright METRONET_BROWSER_CHANNEL=chrome bash backend/scripts/probar-postgres.sh -Dtest=CallesModoLibreE2EPostgresTest`: salida 0; 1 prueba Maven y 1 recorrido Chrome aprobados, sin fallos/errores/omisiones de prueba. PostgreSQL 17.10 temporal real. Verificados fallo seguro de población y reintento, controles de tráfico, construcción de tres estaciones/una línea/dos tramos/un metro, movimiento, guardado y recuperación por REST/PostgreSQL; zoom, rotación, barrios, zonas, POI y tres tamaños. La rama de visualización censal real NO se ejecutó por ausencia de cartografía válida; se registra explícitamente PENDIENTE. El servicio de correo ajeno al flujo está sustituido.
- Documento METRONET: adenda de estado parcial, ZIP/XML válidos; no revisado visualmente en Word.
- Captura real: `poblacion-estado-real.png` en la carpeta de visualizaciones de esta conversación. Muestra el estado de indisponibilidad, no una densidad simulada.

No se modifican entidades, esquema, datos del usuario ni endpoints para población. No se publicaron commits ni se hizo push. No se confirma rendimiento ni exactitud visual de polígonos censales mientras falte una fuente con geometría.

## Resolución posterior: fuente oficial 2011 autorizada

El usuario aprobó utilizar cartografía oficial disponible indicando el año. Esta decisión sustituye la espera de 2023; las notas anteriores se conservan como trazabilidad del impedimento original.

### IMPLEMENTADO y verificado con datos reales

- Año visible **2011**, tanto en leyenda como en fuente y tutorial. Se explica que es densidad residencial histórica, no población actual ni movilidad horaria.
- Polígonos: INE, publicados por MGAP, `https://dgrn.mgap.gub.uy/arcgis/rest/services/BASE/Administrativo/MapServer/1`.
- Población `P_TOT`: INE Censo 2011, publicada por SIT/MVOT, `https://sit.mvot.gub.uy/arcgis/rest/services/07_EXTERNO/INDICADORES_CENSO/MapServer/6`.
- Metadatos oficiales de geometría: `https://dgrn.mgap.gub.uy/Metadatos/ine_zonas_11_metadatos.pdf`. Identifican el Censo 2011, sistema UTM 21S y uso libre citando INE.
- Cruce exacto por departamento, sección, segmento y zona: **13.606 registros de población asociados**, ninguno sin geometría. **13.621 polígonos** en total; 15 polígonos especiales sin sección/segmento censal válido quedan sin población y en gris. No se distribuye población arbitrariamente ni se deducen ceros de un dato ausente.
- Suma de población del archivo publicado por SIT/MVOT: 1.318.755. Se conserva tal como la publica esa fuente; no se ajusta a totales provenientes de otras publicaciones del censo.
- Área calculada a partir de la geometría oficial en metros UTM 21S, descontando huecos antes de reproyectar. Área total de los polígonos descargados: 528,0272 km². Densidad = residentes / área en km².
- Archivo derivado: 6,51 MB; coordenadas a seis decimales, sin simplificar los polígonos. Se triangula una vez y se reproyectan puntos al redimensionar. Los gráficos no reciben entradas del usuario.
- `preparar-poblacion.py` sustituye el preparador fallido de 2023. Requiere GDAL solo durante la preparación; no agrega dependencia al juego. Recibe páginas `geometria-0.json` ... `geometria-13000.json` (1.000 por página) y `poblacion-0.json` ... `poblacion-12000.json` (2.000 por página). Consultas, cantidades y los 21 SHA-256 quedan en `metadata` del GeoJSON. Se usa `resultOffset` para cada página; las URLs son las fuentes anteriores más `/query` y los parámetros documentados en `metadata.consultas`.

### Pruebas finales de la entrega

- JavaScript: `node --test frontend/tests/poblacion-datos.test.cjs frontend/tests/calles-datos.test.cjs frontend/tests/trafico-historico.test.cjs`: **6 aprobadas**, 0 fallos, salida 0.
- Python: `python3 frontend/tests/poblacion-preparacion.test.py`: **3 aprobadas** (área con huecos, códigos normalizados y rechazo de cobertura parcial), salida 0.
- Python tráfico: `python3 backend/scripts/trafico/test_actualizacion.py`: **7 aprobadas**, salida 0; `python3 frontend/tests/trafico-preparacion.test.py`: **2 aprobadas**, salida 0.
- Java: `./mvnw -Dtest=TraficoHistoricoServiceTest test` desde backend: **4 aprobadas**, 0 fallos/errores/omisiones, salida 0.
- Chrome + Spring + PostgreSQL temporal: mismo comando E2E documentado arriba, ahora con **datos censales reales y rama positiva obligatoria**: 1 recorrido de navegador y 1 prueba Maven aprobados, 0 fallos/errores/omisiones; salida 0, final 13/10/2026 07:39:46 -03.
- El recorrido verifica: rechazo y reintento de descarga censal, 13.621 polígonos oficiales, año 2011, capa sin captura de entradas y bajo calles/barrios/red, transparencia independiente, invariancia ante el reloj, activación/desactivación, tutorial, construcción de tres estaciones/una línea/dos tramos/un metro, movimiento y guardado, recuperación real desde PostgreSQL, zoom, rotación, barrios, zonas, POI, tres tamaños (1440×1000, 1280×720, 1920×1080) y salida a simulación sin controles de capas del editor.
- Captura real revisada: `poblacion-2011-real.png`, en visualizaciones de esta conversación. Sustituye la captura previa de indisponibilidad como evidencia del estado actual.

### Límites de la evidencia final

No se ejecutó la regresión completa de los diez niveles. No se midió rendimiento en equipos de gama baja ni todos los navegadores; el recorrido real se probó en Chrome local. No se revisó el documento en Word; se verifican ZIP/XML. La actualización automática mensual corresponde al tráfico, no a población. Se mantiene 2011 hasta incorporar explícitamente una fuente posterior válida. La prueba de persistencia usa PostgreSQL temporal y no toca los diseños del usuario.
