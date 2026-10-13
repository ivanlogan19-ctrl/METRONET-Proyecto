# Desplazamientos históricos y organización del Modo Libre — 13/10/2026

## Estado y autorización

- **DEFINIDO:** el usuario confirmó formalmente la capa de desplazamientos por horario, flechas animadas y construcción por encima; aprobó el análisis de impacto. También autorizó centralizar las fuentes, la reorganización visual y los últimos ajustes de compacidad.
- **IMPLEMENTADO:** capa pasiva de viajes históricos, reloj común a tráfico y desplazamientos, controles por categoría y consulta de fuentes. Se conserva Phaser, Spring, REST y PostgreSQL; no se agregan entidades, migraciones ni endpoints.
- **PROPUESTO, no implementado:** predicción de demanda, comparaciones de diseños, escenarios guardados de análisis y relieve topográfico. Mejorar contraste no incorpora elevaciones ni aumenta la precisión de las fuentes.

## Datos y límites

Fuente: [Encuesta Origen-Destino 2016, DAG-UY](https://catalogodatos.gub.uy/dataset/encuesta-origen-destino-montevideo/resource/f9545ab1-367c-49e5-9157-aa18eb7ce9ac).

El preparador utiliza hora de salida VF5, segmentos codsegorigen/codsegproposito y ponderación wcal0. Los horarios 24–28 pasan a la madrugada siguiente. No se utilizan los campos de actividad como ubicaciones. Se agregan todos los medios de transporte y se publican únicamente datos agregados, sin identificadores personales.

- Registros de entrada: 12.537.
- Incluidos entre sectores representables: 6.253.
- Fuera de cobertura o sin segmento: 5.458.
- Dentro del mismo segmento: 814.
- Sin hora válida: 12.
- Resultado: 5.368 pares por hora y 764 puntos interiores representativos de segmentos.
- Hasta 12 flujos de mayor ponderación por hora. Su animación es ilustrativa; no expresa velocidad, ruta por calle, personas individuales ni información en vivo.
- Cartografía censal 2011, tráfico del período vigente del servidor y viajes 2016: compartir hora no los convierte en datos del mismo año.
- Población y desplazamientos no se actualizan mensualmente; la actualización mensual corresponde al tráfico histórico ya existente.

SHA-256 del ZIP: `9094b380cc6aa845dcf1028f2a722cd3b7fe3d4a35cc4e81338267c90950feec`.

SHA-256 de cartografía: `2b38206c9f9051df559cb1ae1c0b57e5224aa5ffcd9a42ec184f6477d01295e5`.

## Interfaz y reutilización

- Análisis del territorio: Calles, Tráfico, Población, Desplazamientos y Horarios.
- Diseño de la red: Construir, Editar y Acciones; mismas operaciones y pictogramas.
- Panel lateral de 280–340 px en escritorio; separación y altura común con el mapa.
- Un botón por capa; transparencia de calles siempre visible. Horarios permanece desplegado, sin botón de apertura.
- Leyenda de tráfico distribuida uniformemente, muestras de 16–18 px.
- Se reubican los mismos controles conservando eventos, estados y selectores del tutorial; no se duplican operaciones de construcción.
- Calles y tráfico con mayor contraste; bordes de barrio de grosor estable al acercar en Modo Libre; flechas con borde oscuro y encima de las referencias territoriales, debajo de la red.
- Fuentes, años, cobertura y limitaciones en Administración y Reglas; se retiran iconos informativos y fechas del panel del mapa.

## Validación

Comprobaciones frescas sobre la versión final (Horarios siempre visible):

- `node --test frontend/tests/desplazamientos.test.mjs frontend/tests/trafico-historico.test.cjs frontend/tests/poblacion-datos.test.cjs frontend/tests/calles-datos.test.cjs`: 10 aprobadas, 0 fallidas, 0 omitidas; salida 0.
- `python3 frontend/scripts/test_preparar_desplazamientos.py`: 4 aprobadas; salida 0.
- `npm --prefix frontend run build`: compilación correcta; salida 0.
- `METRONET_E2E_CALLES=true METRONET_PLAYWRIGHT_PATH=/Users/loganiglesias/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright METRONET_BROWSER_CHANNEL=chrome bash backend/scripts/probar-postgres.sh -Dtest=CallesModoLibreE2EPostgresTest`: salida 0, finalizó 09:06:57 -03. Una prueba de navegador aprobada, 0 fallidas/omitidas; verificaciones SQL posteriores aprobadas.
- Chrome con DPR 2: 1280×720, 1440×1000 y 1920×1080, panel de ancho máximo 340 px, controles dentro de sus cajas, mapa y lateral alineados, sin desplazamiento de página. Capturas revisadas visualmente.
- Navegación real como administrador y jugador; fuentes consultables en Reglas sin conceder Administración al jugador.
- Datos inválidos de tráfico/población/desplazamientos: fallo visible, reintento y construcción disponible. Tutorial, transparencia, hora 23/00, reproducción, pausa y capas independientes verificados.
- Construcción real de 3 estaciones, 1 línea, 2 tramos y 1 metro; movimiento, guardado y recuperación desde Spring/PostgreSQL. Zoom, rotación, barrios, zonas y POI con capas activas.
- Catálogo oficial de tráfico y endpoint real: período 2026-09, resultado `sin-novedades`.
- Documento académico: ZIP y todos sus XML válidos; salida 0.
- `git diff --check`: salida 0.

Durante el desarrollo se corrigieron dos supuestos del test: el jugador debe entrar desde login/iframe y no mediante navegación directa a una página protegida; el título Horarios del tutorial debe seleccionarse dentro del diálogo para no confundirlo con el nuevo encabezado del panel. La ejecución final incluye ambas correcciones. Una comprobación inicial `node --check` de módulos Vite falló por tratarlos como CommonJS; la compilación Vite posterior verifica esos módulos correctamente.

## Límites de la verificación

No se repitió toda la campaña de diez niveles, todos los navegadores ni una prueba de rendimiento en equipos de baja potencia. La prueba de integración usa Chrome y un Spring real contra PostgreSQL temporal real; solo el servicio de correo ajeno al flujo está sustituido. No toca los diseños de la base del usuario. El documento académico se verificó como ZIP/XML, sin revisión visual en Word. No se afirma mejora de resolución Retina: los cambios de cartografía son de contraste y grosor vectorial.

## Archivos y publicación

Archivos modificados o agregados (incluye compactación previa conservada):

- `backend/src/test/java/com/metronet/backend/configuracion/CallesModoLibreE2EPostgresTest.java`
- `docs/Documento METRONET.docx`
- `frontend/admin.html`
- `frontend/reglas.html`
- `frontend/src/administracion/administracion.js`
- `frontend/src/educacion/PanelTutorialInicial.js`
- `frontend/src/educacion/TutorialCalles.js`
- `frontend/src/educacion/reglas.js`
- `frontend/src/interfaz/PictogramasMapa.js`
- `frontend/src/mapa/MapaScene.js`
- `frontend/src/mapa/capas/CapaBarrios.js`
- `frontend/src/mapa/capas/CapaCalles.js`
- `frontend/src/mapa/capas/CapaTrafico.js`
- `frontend/src/mapa/controles/EditorRedMetro.js`
- `frontend/src/mapa/controles/PanelCalles.js`
- `frontend/src/mapa/controles/PanelPoblacion.js`
- `frontend/src/mapa/controles/PanelTrafico.js`
- `frontend/src/mapa/estilos/calles.css`
- `frontend/src/mapa/estilos/editor-red.css`
- `frontend/tests/calles-modo-libre-e2e.test.cjs`
- `docs/auditorias/desplazamientos-2026-10-13.md`
- `frontend/scripts/preparar-desplazamientos.py`
- `frontend/scripts/test_preparar_desplazamientos.py`
- `frontend/src/mapa/FuentesMapa.js`
- `frontend/src/mapa/capas/CapaDesplazamientos.js`
- `frontend/src/mapa/controles/PanelDesplazamientos.js`
- `frontend/src/mapa/datos/desplazamientos-historicos.json`
- `frontend/src/mapa/desplazamientos/`
- `frontend/src/mapa/estilos/fuentes-mapa.css`
- `frontend/tests/desplazamientos.test.mjs`

No se crean commits ni se publica en remoto en esta etapa.

## Bienvenida de Modo Libre — verificación 09:23

IMPLEMENTADO por solicitud posterior del usuario:
- Bienvenida centrada «Bienvenido al Modo Libre», texto «Utilizá las herramientas de…», tipografía pixelada y acciones «Recorrer las funciones» / «Empezar a diseñar»; sin cruz.
- Recorrido de ocho pasos por las funciones nuevas; no repite zoom ni rotación. Señala los controles deshabilitados sin activarlos.
- Calles, tráfico, población y desplazamientos comienzan apagados; el paseo no los activa automáticamente. La preferencia inicial de calles cambia de encendida a apagada al abrir el editor; no existía persistencia de esa preferencia.
- Oferta del editor versionada v5 para presentar la bienvenida nueva a quienes vieron la anterior.
- Simulación omite la oferta automática para LIBRE y EDICION_LIBRE incluso sin historial. Conserva la ayuda manual y los tutoriales de campaña.

Archivos de esta corrección:
- `frontend/src/educacion/OfertaTutorial.js`
- `frontend/src/educacion/TutorialCalles.js`
- `frontend/src/educacion/TutorialSimulacion.js`
- `frontend/src/educacion/tutorial-inicial.css`
- `frontend/src/mapa/controles/PanelCalles.js`
- `frontend/src/mapa/capas/CapaCalles.js`
- `frontend/src/simulacion/simulacion.js`
- `frontend/tests/calles-modo-libre-e2e.test.cjs`
- `frontend/tests/tutorial-simulacion.test.cjs`
- Este registro.

Verificación fresca después de las modificaciones:
- `npm --prefix frontend run build`: exit 0.
- `node --test frontend/tests/tutorial-simulacion.test.cjs`, Chrome y frontend 5198: 16 PASS, 0 fallos, 0 omitidas. Esta suite usa API de prueba interceptada.
- `METRONET_E2E_CALLES=true bash backend/scripts/probar-postgres.sh -Dtest=CallesModoLibreE2EPostgresTest`, con Playwright y Chrome configurados: exit 0, 1 PASS, 0 fallos/errores/omitidas. Chrome + Spring + PostgreSQL temporal reales; verifica las cuatro capas apagadas antes y durante cada paso, bienvenida centrada, construcción/guardado/recuperación y ausencia de tutorial automático de simulación sin historial.
- Captura real: `/tmp/metronet-bienvenida-libre-real.png`, inspeccionada visualmente.
- `git diff --check`: exit 0.

Solo presentación y pruebas; no cambian endpoints ni esquema. No se ejecutó una partida completa de los diez niveles ni otros navegadores en esta corrección. No se publicó en Git.
