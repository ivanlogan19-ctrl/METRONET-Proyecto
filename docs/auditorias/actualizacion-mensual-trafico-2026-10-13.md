# Actualización mensual de tráfico histórico

## Decisión y alcance

DEFINIDO: consulta histórica de tráfico en Modo Libre, con controles de iconos y construcción de la red por encima. La etapa inicial excluía actualizaciones automáticas.

Confirmación formal posterior del usuario: «CONFIRMO CAMBIO FORMAL DE METRONET: actualizar automáticamente cada mes los datos históricos de tráfico, conservando los últimos datos válidos ante fallos.» Después del análisis de impacto del servidor, endpoint, archivos persistentes, documentación y pruebas, respondió «Apruebo» el 13/10/2026.

IMPLEMENTADO en esta ampliación: actualización programada dentro del servidor Spring existente, sin servicios adicionales, nuevas tablas, migraciones ni cambios al motor de metros. No se modifica la definición de UV/UT, los diseños ni los niveles. No incluye publicación Git.

## Funcionamiento y aceptación

- Spring comprueba el vencimiento 30 segundos después del arranque y luego cada hora, sin bloquear solicitudes del mapa. Usa fecha de America/Montevideo.
- Si la fuente ya cubre el último mes cerrado, la próxima consulta de red corresponde al primer día del siguiente mes. Si la publicación está demorada o falla, reintenta al día siguiente. El vencimiento queda almacenado entre reinicios.
- Se selecciona el recurso mensual más reciente posterior al vigente y anterior al mes actual. Octubre de 2026 ya figura en el catálogo consultado el 13/10, pero se descarta por no haber terminado.
- Descargas exclusivamente HTTPS desde los dominios oficiales autorizados; se validan también las redirecciones. Límite de catálogo 5 MB, ZIP 400 MB, único CSV de hasta 2 GB y proceso máximo 30 minutos.
- Se reutilizan `resumir`, `vincular` y `procesar` de `preparar-trafico.py`: misma asociación cartográfica y mismos índices relativos, sin extrapolaciones.
- Aceptación: fechas de todos los días del mes, perfiles de 24 horas, coordenadas en Montevideo, intensidades finitas 0–1 o nulas, no más de 1% de filas inválidas y al menos 50% de perfiles horarios disponibles. Una caída superior al 50% del número de tramos frente al período vigente se rechaza para revisión; no se disfraza de actualización exitosa.
- Se procesa en una carpeta temporal, escribe y sincroniza un archivo temporal antes de reemplazar `actual.json` atómicamente. Primero se conserva `anterior.json`. Se impiden actualizaciones concurrentes mediante bloqueo de archivo.
- Si falta o se corrompe el archivo activo, el endpoint intenta el anterior y luego el respaldo incluido en el programa. La actualización no reemplaza datos por errores ni modifica el respaldo empaquetado.
- El frontend consulta `GET /api/trafico/historico` al activar la capa, con caché deshabilitada. La fecha y cobertura se derivan de la respuesta. Una capa ya abierta mantiene su instantánea; al reactivarla o volver al editor recibe la versión nueva, sin recompilar.

## Arquitectura y archivos

- `TraficoHistoricoController`: endpoint GET de datos públicos, respuesta 200 JSON con el contrato existente (`version`, `periodo`, `tramos`, fuente y metodología), y metadatos opcionales `actualizadoEl` y `recursoOriginal`.
- `TraficoHistoricoService`: lectura validada y recuperación, coordinación del proceso y bloqueo. La programación utiliza Spring Scheduling.
- `backend/scripts/trafico/actualizar-trafico.py`: catálogo, descarga, validación, reemplazo y calendario persistente. Biblioteca estándar de Python; no agrega paquetes.
- `frontend/scripts/preparar-trafico.py`: procesamiento existente extraído como función reutilizable. Se conserva su ejecución manual.
- Maven incluye el actualizador, preparador, calles y respaldo dentro del JAR, evitando rutas dependientes del checkout al ejecutar el servidor.
- `CapaTrafico.js`, `PanelTrafico.js`: consulta al servidor, recarga al activar y explicación de actualización en la ayuda existente. Se conservan apariencia e iconos.
- Configuración en `application.properties` y `backend/.env.example`; actualización automática deshabilitada por defecto solo en el perfil de pruebas.
- Pruebas: `test_actualizacion.py`, `TraficoHistoricoServiceTest`, ampliación de `CallesModoLibreE2EPostgresTest` y `calles-modo-libre-e2e.test.cjs`.

## Instalación y operación

Requiere Python 3.11 o superior accesible al proceso Java. El proyecto ya utiliza Python para sus herramientas locales; ahora es requisito del actualizador en el servidor desplegado. No se ejecutan comandos recibidos del navegador ni se incorpora una cola o servicio externo.

Variables opcionales:

- `METRONET_TRAFICO_ACTUALIZACION_HABILITADA=true` (valor predeterminado).
- `METRONET_TRAFICO_PYTHON=python3`: ejecutable de Python 3.11+.
- `METRONET_TRAFICO_DIRECTORIO`: ruta absoluta escribible y persistente. Por defecto `${user.home}/.metronet/trafico`; conservarla entre despliegues.

Archivos de operación: `actual.json`, `anterior.json`, `estado.json` y `actualizacion.lock`. El estado indica última/próxima comprobación y resultado (`actualizado`, `sin-novedades`, `error`). No contienen credenciales ni datos de usuarios. No versionar los archivos de la instalación.

Si falla Python, el almacenamiento o la fuente, la aplicación sigue sirviendo el respaldo y registra el fallo. Los ZIP/CSV se procesan de forma temporal; se necesita espacio suficiente para el ZIP y los resúmenes. No se extrae el CSV completo al disco.

Después de compilar el nuevo JAR, reiniciar el servidor mediante el arranque habitual (`npm start` desde la raíz). El servidor debe estar encendido y conectado para comprobar la fuente; al volver a encenderse recupera el vencimiento pendiente.

## Evidencia

La actualización real se ejercitó en `/tmp/metronet-actualizacion-real`, partiendo de una versión anterior artificial exclusivamente de prueba. Se descargó el ZIP oficial completo de septiembre, se procesaron 8.606.947 registros y se publicaron 407 tramos como `2026-09`, con salida 0. No se modificaron datos del usuario. No se esperó al mes siguiente: el cambio de mes y la recuperación temporal se verifican con fechas controladas en las pruebas.

El catálogo real también se consultó mediante el actualizador empaquetado, conservando septiembre (`sin-novedades`) y respondiendo HTTP 200 desde Spring. Resultados finales (13/10/2026):

- `python3 backend/scripts/trafico/test_actualizacion.py`: 7 pruebas, salida 0.
- `python3 frontend/tests/trafico-preparacion.test.py`: 2 pruebas, salida 0.
- `node --test frontend/tests/trafico-historico.test.cjs frontend/tests/calles-datos.test.cjs`: 4 pruebas, salida 0.
- En backend, `./mvnw -q -Dtest=TraficoHistoricoServiceTest test`: 4 pruebas, 0 fallos, 0 errores, 0 omitidas; salida 0.
- `./mvnw -q -DskipTests package`: JAR actualizado, salida 0. Esta orden empaqueta; las pruebas se ejecutaron por separado.
- `npm --prefix frontend run build`: salida 0.
- `METRONET_TRAFICO_PRUEBA_ACTUAL=/tmp/metronet-actualizacion-real/datos/actual.json METRONET_E2E_CALLES=true METRONET_PLAYWRIGHT_PATH=/Users/loganiglesias/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright METRONET_BROWSER_CHANNEL=chrome bash backend/scripts/probar-postgres.sh -Dtest=CallesModoLibreE2EPostgresTest`: 1 prueba integral, 0 fallos/errores/omisiones, salida 0. Finalizó 01:24:25 -03. Chrome, endpoint Spring, actualizador empaquetado con consulta oficial y PostgreSQL temporal reales. Se sirvió la instantánea recién descargada y procesada; el navegador ejercitó edición/guardado/recuperación, capa, controles, cámara, POI y tres tamaños.
- Documento METRONET: validación de integridad ZIP y XML, salida 0. No se verificó visualmente en Word.
- `git diff --check`: salida 0.

Los archivos locales de la aplicación están actualizados y el JAR compilado. El proceso de usuario que ya estaba escuchando en 8080 no se reinició durante la prueba; requiere reiniciar el arranque habitual para utilizar el JAR nuevo. No se efectuó commit ni push.

## Límites

La fuente puede cambiar su formato o cobertura y requerir mantenimiento; se conserva el último período válido. El servidor no obtiene tráfico en vivo ni garantiza que la Intendencia publique cada mes en una fecha determinada. No actualiza automáticamente la cartografía base de calles. No se volvió a jugar la campaña completa de diez niveles.
