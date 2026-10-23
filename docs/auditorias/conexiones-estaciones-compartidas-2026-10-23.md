# Conexiones mediante estaciones compartidas — 23/10/2026

## Estado y autorización

- DEFINIDO: el documento académico conserva su versión previa; no se modificó automáticamente.
- Cambio formal aprobado por el usuario y autorizado para ejecutar: sustituir conexiones con vía, metro y UV/UT propios por estaciones compartidas explícitas. Cada línea conserva identidad, color, trenes y configuración. No se exige un mínimo de tres estaciones por línea ni que ambas continúen después de la unión.
- IMPLEMENTADO: editor, representación, servicios, persistencia, catálogo de diez niveles y tutoriales adaptados. Una coincidencia geométrica no activa por sí sola una conexión; debe usarse Conexión.
- PROPUESTO/PENDIENTE documental: actualizar el documento académico al modelo aprobado, mediante autorización específica.

## Comportamiento

Línea crea o prolonga una línea conservando su identidad. Conexión permite marcar una estación que ya comparten dos líneas, o prolongar el extremo de una línea hasta una estación de otra y marcar allí la unión. Ambas líneas pueden terminar o continuar; sus trenes permanecen en su recorrido. La estación compartida usa un nodo octagonal mayor, dividido con los colores de las líneas, sin cartel superior.

Se retiraron las opciones adicionales que aparecían en el panel de herramientas al resolver una conexión. Si intervienen varias líneas coincidentes, la elección se realiza pulsando sus vías en el mapa. La selección ya existente para asignar metros entre vías superpuestas se conserva.

Reloj, configuración UV/UT y regla presentan solamente líneas. Los tutoriales explican el nuevo concepto y vuelven a ofrecer la lección modificada. Los diez niveles mantienen cinco metas; conexiones desde el cuarto, POI desde el sexto.

## Capas y contratos

Frontend Phaser/JavaScript, servicios Spring y repositorios PostgreSQL. No se cambió la arquitectura ni se añadieron dependencias.

Se conserva el endpoint de conexiones: la respuesta identifica la misma estación en ambos extremos. La creación puede extender primero la línea de origen. Las unidades nuevas requieren nombre de línea; una petición antigua que asigne metro a conexión se rechaza con 400. La distancia, reproducción y parámetros dejan de interpretar conexiones como rutas independientes.

## Base de datos y versión local

Migración 027 aplicada tras respaldo completo verificable en `.local/respaldos/estaciones-compartidas.I2hkz1/metronet.dump`. Se archivan redes antiguas y los intentos adaptados. Las unidades propias de conexiones se retiran del estado activo y quedan en el archivo recuperable. Una geometría antigua imposible de prolongar desde un extremo aborta toda la migración; no se inventa una conversión.

La base local no tenía conexiones antiguas al aplicar esta migración. Se compararon conteos y huellas de usuarios, diseños, simulaciones e intentos (excluyendo únicamente el vínculo a la publicación): sin diferencias. El servidor local arrancó con Java 25 y publicó diez niveles v8. Frontend responde HTTP 200 en 5173; backend iniciado en 8080.

## Evidencia

- Compilación frontend: `npm --prefix frontend run build`, salida 0, 3,08 s. Persisten avisos preexistentes de atributos de importación de JSON/SVG.
- Empaquetado backend Java 25: Maven package sin repetir tests, BUILD SUCCESS, salida 0.
- Pruebas puras de catálogo, motor y orientación: 47/47 aprobadas.
- Navegadores Chrome y Firefox: 47/47 en cada uno para líneas/conexiones, guardado estable y tutorial del recorrido. Estas pruebas usan API controlada.
- Regresión adicional tras retirar carteles: 5/5 en Chrome y 5/5 en Firefox, salida 0 en ambos.
- Suite backend completa: 395 casos, 391 aprobados, 3 omitidos, 1 fallo por ausencia del frontend de prueba en 5198. Después de iniciar ese frontend, repetición de VinculoUvUtLibrePostgresTest y ConexionesLineasPostgresTest: 4/4 aprobados, salida 0. Incluye Chrome→API real→PostgreSQL aislado para UV/UT y migración de conexiones antiguas. La suite completa no se repitió después de resolver ese requisito del entorno.
- Tutorial actualizado de simulación en Firefox: 17/17 aprobados, salida 0; incluye repetición, omisión, primer paso sobre mapa, escritorio y pantalla estrecha.
- Campaña integral Chrome→backend real→PostgreSQL aislado: diez niveles completados con 100 puntos, cierre completo del navegador y reapertura de cada diseño, mismas estaciones/líneas/conexiones/metros/UV/UT/metas/puntaje, desbloqueo y acceso real a Modo Libre. RecorridoIntegralE2EPostgresTest: 1/1 aprobado, salida 0, BUILD SUCCESS, 5 min 52 s.
- La primera ejecución integral se detuvo en el nivel 5 porque el automatismo no resolvía el selector visible de metro cuando había vías cercanas. Se corrigió únicamente el conductor de prueba para pulsar la opción de la línea y se repitieron los diez niveles desde cero.
- Sintaxis del editor comprobada como módulo ES y prueba CJS: salida 0. La primera invocación directa de Node trataba incorrectamente el archivo de Vite como CommonJS; se repitió con --input-type=module.
- git diff --check: salida 0.

## Límites

Safari no se comprobó en esta ejecución. La publicación en Git no se realizó. Las pruebas de persistencia con escritura usan bases PostgreSQL aisladas; la base real local recibió únicamente la migración y publicación autorizadas, con respaldo y comparación de datos protegidos.

## Archivos modificados

- `backend/src/main/java/com/metronet/backend/configuracion/VerificadorEsquemaUvUt.java`
- `backend/src/main/java/com/metronet/backend/repository/ConexionesLineasRepository.java`
- `backend/src/main/java/com/metronet/backend/repository/CriterioUvUtRepository.java`
- `backend/src/main/java/com/metronet/backend/repository/DisenoAdministracionRepository.java`
- `backend/src/main/java/com/metronet/backend/repository/DistanciasRedRepository.java`
- `backend/src/main/java/com/metronet/backend/repository/PuntuacionRepository.java`
- `backend/src/main/java/com/metronet/backend/repository/RecorridoIntegralRepository.java`
- `backend/src/main/java/com/metronet/backend/repository/RestriccionesGeograficasRepository.java`
- `backend/src/main/java/com/metronet/backend/repository/SimulacionRepository.java`
- `backend/src/main/java/com/metronet/backend/repository/VinculoUvUtLibreRepository.java`
- `backend/src/main/java/com/metronet/backend/service/ConexionesLineasService.java`
- `backend/src/main/java/com/metronet/backend/service/DistanciasRedService.java`
- `backend/src/main/java/com/metronet/backend/service/MetasRecorrido.java`
- `backend/src/main/java/com/metronet/backend/service/RecorridoIntegralService.java`
- `backend/src/main/java/com/metronet/backend/service/SimulacionService.java`
- `backend/src/main/java/com/metronet/backend/service/ValidacionPublicacionNivelService.java`
- `backend/src/test/java/com/metronet/backend/configuracion/ConexionesLineasPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/EscalaSimulacionPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/MatrizPuntuacionRecorridoPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/configuracion/RecorridoIntegralPostgresTest.java`
- `backend/src/test/java/com/metronet/backend/service/ConexionesLineasServiceTest.java`
- `backend/src/test/java/com/metronet/backend/service/MetasRecorridoTest.java`
- `frontend/src/administracion/AdministracionNiveles.js`
- `frontend/src/administracion/EditorRedReferenciaNivel.js`
- `frontend/src/educacion/AyudaContextual.js`
- `frontend/src/educacion/FuncionesCampana.js`
- `frontend/src/educacion/PanelTutorialInicial.js`
- `frontend/src/educacion/RecorridoInicial.js`
- `frontend/src/educacion/TutorialInicial.js`
- `frontend/src/educacion/TutorialSimulacion.js`
- `frontend/src/educacion/extras/PresentacionExtras.js`
- `frontend/src/educacion/extras/TarjetasExtras.js`
- `frontend/src/educacion/glosario/Conceptos.js`
- `frontend/src/educacion/mensajesTransicion.json`
- `frontend/src/educacion/recorrido-integral.json`
- `frontend/src/interfaz/PictogramasMapa.js`
- `frontend/src/mapa/capas/CapaRedMetro.js`
- `frontend/src/mapa/configuracion/RecorridosRed.js`
- `frontend/src/mapa/controles/CreacionDirecta.js`
- `frontend/src/mapa/controles/EditorRedMetro.js`
- `frontend/src/mapa/controles/MedicionDistancias.js`
- `frontend/src/simulacion/PanelDesempeno.js`
- `frontend/src/simulacion/SelectorLineasReproduccion.js`
- `frontend/src/simulacion/simulacion.js`
- `frontend/tests/lineas-conexiones.test.cjs`
- `frontend/tests/metro-orientacion.test.cjs`
- `frontend/tests/motor-velocidad.test.cjs`
- `frontend/tests/recorrido-integral-e2e.test.cjs`
- `frontend/tests/recorrido-integral.test.cjs`
- `frontend/tests/simulacion-guardado-estable.test.cjs`
- `frontend/tests/simulacion-reloj-mapa.test.cjs`
- `frontend/tests/soporte/editor.cjs`
- `frontend/tests/tutorial-recorrido-integral.test.cjs`
- `frontend/tests/tutorial-simulacion.test.cjs`
- `database/027_estaciones_compartidas.sql`
