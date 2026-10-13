# Tráfico histórico por horario en Modo Libre

## Decisión y alcance

Confirmación formal del usuario: «CONFIRMO CAMBIO FORMAL DE METRONET: incorporar en Modo Libre una capa de intensidad de tráfico histórico por horario, con controles de iconos y construcción de la red por encima.»
Después de presentar el análisis de impacto, el usuario respondió «Apruebo» el 13/10/2026. La aprobación incluye interfaz, datos históricos, documentación y pruebas reales. No incluye publicación Git.

DEFINIDO previamente: diseño y simulación educativa de redes de metro, consulta de referencias geográficas y arquitectura Phaser/JavaScript → Spring Boot → PostgreSQL.

IMPLEMENTADO previamente: cartografía de calles del servicio de Geomática, con carga local diferida, transparencia y construcción superpuesta. El tráfico horario no existía.

Cambio formal aprobado: añadir consulta de intensidad histórica como referencia visual en el editor de Modo Libre. No modifica circulación ferroviaria, UV, UT, evaluación de niveles, esquema ni contratos REST. No pretende simular congestión, demanda, pasajeros, emisiones ni efecto del metro sobre el tránsito. Población y desplazamientos siguen PROPUESTOS para otras etapas.

## Impacto técnico

- Requerimiento: consultar cambios horarios históricos manteniendo disponible el diseño de la red.
- Casos de uso: activar/ocultar tráfico, seleccionar hora 00–23, reproducir/pausar el día, consultar fuente/cobertura, construir/editar/guardar con la capa activa.
- Presentación: `CapaTrafico` pasiva, profundidad 2.5, por debajo de la red; reutiliza proyección de `CapaBarrios` y cámara Phaser. `PanelTrafico` se integra en `PanelCalles`, con los pictogramas, tamaños y tutorial existentes.
- Estado y reglas de visualización: `ModeloTrafico.mjs` valida el archivo, normaliza el reloj y clasifica intensidad. Reloj independiente de UV/UT; se detiene al ocultar controles/capa/documento o salir.
- Datos: archivo estático procesado fuera de la aplicación, sin dependencia de una API externa durante el juego. `preparar-trafico.py` reproduce conversión y asociación.
- Persistencia: se conserva el guardado de diseños existente. No se guarda la hora de referencia dentro de la simulación ni se alteran las ejecuciones.
- Documentación: adenda funcional y de usuario en Documento METRONET y este registro técnico.
- Alcance/plazo: primera entrega limitada a un mes completo; el trabajo depende de validar cobertura y asociación geográfica antes de integrar controles. Actualizaciones automáticas y selección de varios meses quedan fuera de esta etapa.

## Fuente y metodología

- Fuente: Centro de Gestión de Movilidad, Intendencia de Montevideo. Licencia DAG-UY.
- Catálogo: https://ckan.montevideo.gub.uy/dataset/conteo-vehicular-en-las-principales-avenidas-de-montevideo
- Archivo: https://ckan-data.montevideo.gub.uy/dataset/a2b2243b-358f-4f03-b7bc-0a32c25ed10c/resource/a8985612-eb3a-498a-9a51-83ea44b07e64/download/conteo_setiembre_2026.zip
- Período: 01–30/09/2026, todos los días incluidos. El catálogo publica registros cada cinco minutos en entregas mensuales. No es tiempo real.
- Inspección: 8.606.947 filas; 905 duplicadas descartadas; 1.000 pares detector/carril. Se asocian 952 a 407 tramos; se excluyen 4 de prueba/inestables y 44 sin asociación conservadora.
- Unión: nombre normalizado de la avenida y distancia a su geometría de hasta 60 m. Se conserva solo el tramo cartográfico más cercano, no toda la avenida. Distancia máxima observada: 38,43 m. Se guardan detector, carril, coordenadas, distancia, cruce anterior y siguiente para auditar la asociación. La capa reúne los sentidos y no representa flujos direccionales separados.
- Media por hora del campo `volumen_hora` por detector/carril, mínimo 36 muestras y 3 días por hora. Se suman las medias de los carriles asociados al mismo tramo usando el mismo conjunto en cada hora. Si falta algún carril, la hora queda sin datos.
- Índice: media agregada dividida por el máximo de sus 24 medias horarias válidas. Verde ≤1/3, amarillo ≤2/3, rojo >2/3. La comparación es temporal dentro de cada tramo, no capacidad absoluta entre vías.
- Faltantes: 696 celdas tramo/hora sin perfil válido, incluyendo perfiles enteramente en cero. Se muestran neutras. No se interpolan ni se convierten en baja circulación.
- Discrepancia de fuente: el catálogo define `volumen_hora` como estimación de tasa horaria a partir de los últimos cinco minutos; METADATA lo describe como cantidad en la última hora. Esta entrega no elige silenciosamente una interpretación: utiliza el campo exclusivamente para un índice relativo y no publica vehículos/hora, velocidad ni congestión.
- Trazabilidad: SHA-256 del ZIP, fechas, metodología, muestras y asociaciones en `trafico-historico.json`. Los archivos brutos de 750 MB no se incorporan al juego ni a Git.

Reproducir: `python3 frontend/scripts/preparar-trafico.py /ruta/conteo_setiembre_2026.zip 2026-09`.

## Riesgos y aceptación

- Asociación errónea: coincidencia nominal y cercanía métrica; excluir casos sin coincidencia. No atribuir mediciones a vías vecinas por proximidad solamente.
- Confundir intensidad con atasco: explicación en tutorial, ayudas y fuente; ausencia de cifras de velocidad/capacidad; no extrapolar cobertura.
- Rendimiento: 407 tramos, datos resumidos de aproximadamente 627 KB, carga diferida y redibujo al cambiar hora/zoom, sin procesar el CSV dentro del navegador.
- Interferencia con el metro: gráficos sin entradas; reloj separado; pruebas de construcción, movimiento y recuperación por REST/PostgreSQL.
- Fallo de carga: aviso y reintento, sin bloquear editar y sin sustituir datos por valores inventados.

## Evidencia de implementación y validación

IMPLEMENTADO y comprobado el 13/10/2026:

- `node --test frontend/tests/trafico-historico.test.cjs frontend/tests/calles-datos.test.cjs`: 4 pruebas aprobadas, salida 0.
- `python3 frontend/tests/trafico-preparacion.test.py`: 2 pruebas aprobadas, salida 0.
- `npm --prefix frontend run build`: compilación aprobada, salida 0.
- `METRONET_E2E_CALLES=true METRONET_PLAYWRIGHT_PATH=/Users/loganiglesias/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright METRONET_BROWSER_CHANNEL=chrome bash backend/scripts/probar-postgres.sh -Dtest=CallesModoLibreE2EPostgresTest`: salida 0, Maven 1 prueba aprobada, sin fallos, errores ni omisiones; navegador 1 recorrido integral aprobado. Terminado a las 01:01:02 -03.
- El recorrido usa Chrome, Spring y PostgreSQL temporal reales: activa/reintenta la capa, cambia/reproduce/pausa la hora, consulta cobertura, construye tres estaciones, una línea, dos tramos y un metro; mueve una estación, guarda y recupera la red. Comprueba zoom, rotación, barrios, zonas, POI, tres tamaños de pantalla y salida del editor con reloj activo. Solo el servicio de correo ajeno al recorrido está sustituido.
- `Documento METRONET.docx`: integridad ZIP y XML comprobada. Se agregó la adenda autorizada sin modificar el modelo de datos ni contratos REST.

Archivos de la entrega: `CapaTrafico.js`, `PanelTrafico.js`, `ModeloTrafico.mjs`, `trafico-historico.json`, `preparar-trafico.py`; integración en `CapaCalles.js`, `PanelCalles.js`, `MapaScene.js`, `EditorRedMetro.js`, `PictogramasMapa.js`, `calles.css`, `TutorialCalles.js`, `RecorridoInicial.js` y `PanelTutorialInicial.js`; pruebas de preparación/datos y ampliación de `calles-modo-libre-e2e.test.cjs`; Documento METRONET y este registro. Se reutiliza el arnés PostgreSQL de calles.

Límites de la evidencia: no se ejecutó la regresión completa de los diez niveles ni se revisó visualmente el documento en Word. La prueba real usa una base PostgreSQL temporal, no altera los diseños del usuario. Cobertura histórica limitada a septiembre de 2026; no se implementaron datos en vivo, congestión absoluta ni extrapolación a toda la red vial.
