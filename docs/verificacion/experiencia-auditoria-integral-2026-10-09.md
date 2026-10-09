# Auditoría integral de Experiencia de juego — 2026-10-09

## Alcance y aceptación

IMPLEMENTADO: revisión de la interfaz actual y de su recorrido hasta los servicios y PostgreSQL. La petición autoriza comprobar todas sus acciones, retirar acciones sin efecto demostrado y subir los cambios verificados. Los niveles personales deben conservarse exactamente como estaban.

DEFINIDO: se conserva la separación presentación JavaScript → REST → Controller → Service → Repository/JDBC → PostgreSQL. Esta auditoría no introduce reglas de juego ni modifica el Documento METRONET. Las decisiones funcionales anteriores, como publicar versiones y conservar partidas iniciadas, no se redefinen a partir del resultado de una prueba.

Criterios observables:

- Un campo editado llega al borrador y reaparece al volver a abrirlo.
- Guardar no publica. Publicar requiere una referencia viable y revisión editorial; el contenido publicado llega al contrato del jugador.
- Modificar un umbral cambia el cumplimiento del objetivo correspondiente; quitarlo retira la condición.
- Las acciones de lista distinguen quitar un elemento de eliminar toda la regla.
- Las herramientas modifican las acciones disponibles y la viabilidad de la referencia.
- Las ejecuciones necesarias para cada objetivo de simulación cambian su cumplimiento.
- Las versiones de partidas anteriores siguen disponibles después de publicar y limpiar el historial.
- Las pruebas no modifican la instalación personal. Se comparan huellas antes/después.

## Matriz de acciones y efectos

| Área / opciones | Efecto real / consumidor | Evidencia ejecutable |
| --- | --- | --- |
| Seleccionar uno de los diez niveles; pestañas; salir y cancelar salida | Abre su borrador, cambia el panel y protege ediciones pendientes | `administracion-niveles-layout`, `administracion-niveles-e2e` |
| Guardar / disquete | PUT de revisión, persistencia privada, reapertura; conserva ediciones posteriores a una respuesta tardía | E2E real diez niveles, pruebas de concurrencia de interfaz y `AdministracionNivelesBorradorPostgresTest` |
| Previsualizar | Ensaya la red y ejecuciones con `JuegoEducativoService` y `SimulacionService`, luego revierte el ensayo | `ValidacionPublicacionNivelPostgresTest`, `ImpactoReglasAdministradasPostgresTest`, E2E real |
| Vista previa: consigna, diagnóstico, siete tarjetas | Muestra el contenido guardado, condiciones cumplidas/pendientes e imagen/fuente de la ficha elegida | E2E real y pruebas de interfaz |
| Revisión editorial y publicar | Impide publicar sin revisión, con referencia inválida, con revisión obsoleta o huella desactualizada; crea publicación completa | E2E real, `ValidacionPublicacionNivelPostgresTest`, `AdministracionNivelesControllerTest` |
| Nombre, dificultad, relato, objetivo, instrucciones | Persisten y aparecen en la presentación del nivel y en el contenido del jugador | Edición de los cinco campos en los diez niveles; publicación y lectura por jugador en E2E |
| Mínimo estaciones, líneas, conexiones, unidades; máximo estaciones | Modifican condiciones de `JuegoEducativoService`; el exceso no impide una simulación operable, pero impide acreditar el máximo y aplica la política de puntos vigente | Pruebas diferenciales PostgreSQL, `MatrizPuntuacionRecorridoPostgresTest`, `PuntuacionDescuentosPostgresTest`, interfaz de Constructor |
| Exigir simulación | Agrega una condición pendiente hasta una ejecución de la red/UV actuales | Prueba diferencial con simulación real; recorrido de diez niveles |
| POI: elemento, ID, radio; agregar, quitar, papelera | Cambian los destinos/radios; menos quita solo el seleccionado, papelera elimina la regla completa; volver a agregar funciona desde una lista vacía | Prueba diferencial POI/radio, pruebas de interfaz de listas y `CondicionesGeograficasServiceTest` |
| Lugares en una misma línea | Requiere un recorrido conectado de una línea que cubra todos los POI | Pruebas geográficas y diferencial PostgreSQL |
| Barrios/zonas: tipo, nombre, mínimo; lista y acciones | Evalúa geometrías reales y cantidad de estaciones en cada área; un nombre sin geometría no se acredita | `JuegoGeograficoIntegracionTest`, prueba diferencial PostgreSQL, interfaz de reglas |
| Mínimo transbordos / contar compartidas por líneas | Cuenta estaciones conectadas por varias líneas; la opción distingue el cómputo por conexión de la marca histórica de transbordo | Prueba diferencial PostgreSQL y `EscalaSimulacionPostgresTest` |
| Exigir geografía válida | Agrega la condición territorial; no reemplaza las validaciones estructurales de la red | Prueba diferencial y suites geográficas |
| Objetivos velocidad, duración, individual, global, combinación | Se acreditan a partir de ejecuciones y cambios reales de UV/UT, no por marcar la casilla en Administración | 32 combinaciones en `ImpactoReglasAdministradasPostgresTest`; recorrido real; suites de puntuación |
| Herramientas estaciones, líneas, conexiones, metros, simulación | El editor del jugador ofrece/habilita las herramientas; una referencia que las necesita no puede validarse si se deshabilitan | 32 combinaciones de contrato por nivel; ensayo de las cinco herramientas; Constructor y campaña real |
| Agregar regla admitida, valor previo y eliminar regla | Inserta el valor elegido; la condición se guarda y se evalúa. La papelera retira la condición | Interfaz prueba todos los tipos ofrecidos; validación de tipos/límites; pruebas diferenciales del evaluador |
| Mapa: agregar, conectar, mover, línea activa, flechas de teclado | Modifica coordenadas, pertenencia de conexión y red privada de referencia | `red-referencia-nivel`, clics reales E2E |
| Referencia: estaciones (nombre, X/Y, transbordo), líneas, conexiones (línea/A/B) | Alimenta la red real usada por la previsualización | E2E crear/editar/quitar/reabrir las tablas; evaluación PostgreSQL |
| Referencia: unidades (línea, capacidad, UV) y ejecuciones (duración, ritmo, UV por unidad) | Crea unidades y ejecuta la secuencia real para probar la solución | E2E de tablas; pruebas de validación, escala y comparación; no queda una partida creada por el ensayo |
| Límite UT / presupuesto UV en niveles 4–10 | Modifican `CriterioUvUtService` y el resultado que puede acreditar el nivel | Límites válidos/incumplidos en cada nivel; guardado UI diez niveles; publicación UV/UT |
| Tarjetas: título, texto, aprendizaje, fuente, URL, descripción, catálogo de imagen | Se almacenan en la publicación; el jugador recibe esos textos, vínculo, descripción e imagen | Edición de los seis campos de texto en las 70 tarjetas, decodificación de sus imágenes y cambio de imagen en una tarjeta de cada nivel; publicación/lectura en E2E, rotación y visualización educativas |
| Historial: anterior/siguiente | Pagina registros sin modificar publicación ni borrador | Prueba de navegación de historial en interfaz |
| Historial: borrar, cancelar, aceptar | Borra versiones antiguas sin uso; conserva vigente, base del borrador y versiones ligadas a partidas | E2E con dos jugadores y `LimpiezaHistorialNivelesPostgresTest` |

La red de referencia tiene una función administrativa: demuestra una solución al publicar. No se convierte en la red inicial del jugador. Guardar, consultar y limpiar historial también son funciones reales aunque no otorguen puntos.

## Dependencias que no significan una opción inútil

- POI requiere cobertura o misma línea activa para exigir esos destinos. Las áreas tienen su propio objetivo territorial.
- Individual/global requieren varios metros. Marcar esos objetivos no ejecuta la simulación por el jugador.
- Contar estaciones compartidas cambia el cómputo del mínimo de transbordos; necesita ese mínimo y las herramientas correspondientes.
- Escribir una exigencia en el texto no crea una regla. Texto y reglas tienen consumidores distintos.
- Publicar afecta nuevas partidas; las iniciadas conservan la publicación con la que comenzaron.

No se identificó una acción visible sin consumidor real que justifique retirarla en esta auditoría. Las pistas, prácticas gratuitas y reversión no se ofrecen como acciones de esta vista. No se eliminaron funciones válidas para satisfacer artificialmente el criterio de limpieza.

## Pruebas y resultados

| Comprobación | Resultado observado |
| --- | --- |
| Suite completa de backend con campaña real activada | 331/331 aprobadas, 0 fallos, 0 errores, 0 omitidas; salida 0 |
| Campaña desde Chrome: diez niveles y acceso a Modo Libre | 11/11 aprobadas; salida 0 del navegador y de Maven; incluida como prueba integrada en la suite anterior |
| Interfaz y regresión de Administración, UV/UT, mapa, Constructor, interacción y aprendizaje | 128/128 aprobadas; salida 0 |
| Mapa de referencia ampliado: mover, conectar y cambiar línea activa | 1/1 aprobada; salida 0 |
| Administración real, navegador → Spring Boot → PostgreSQL temporal | 13/13 aprobadas; salida 0: diez niveles, tablas de referencia y publicación/historial |
| Impacto diferencial de reglas y las 32 combinaciones de objetivos | 49/49 aprobadas; salida 0; también repetidas dentro de las 331 |
| Construcción de frontend | Aprobada; salida 0 |
| Integridad de la instalación personal | Comparación de huellas antes/después idéntica; `cmp` salida 0 |
| Sintaxis JavaScript y diferencias | Comprobación como módulos ES para código y CommonJS para pruebas, más `git diff --check`: salida 0 |

El recorrido final obtuvo por nivel 100, 90, 80, 70, 100, 100, 100, 60, 90 y 60 puntos (850 en total), con diez intentos completados confirmados en PostgreSQL. Guardar y simular no adelantaron la aprobación; finalizar sí habilitó el siguiente nivel. Se comprobó la entrada real a Modo Libre después de la victoria final.

Incidencias de la comprobación: la primera ampliación del E2E usó un selector de «Nombre» ambiguo; se acotó al panel Desafío y las 13 pruebas pasaron al repetir. Un primer recorrido de campaña pasó nueve niveles y perdió el frame del navegador en el décimo; esa ejecución no se considera aprobada. Una tentativa de acelerar la repetición mediante el control de ritmo falló porque ese control está oculto en la interfaz vigente: se retiró esa tentativa del test y se repite con la animación normal, sin cambiar el producto para facilitar la prueba.

La repetición final con la animación normal completó todos los niveles sin fallos ni errores de página/API. No fue necesario cambiar lógica del producto a raíz de esas incidencias. Se conservó el diagnóstico adicional de URLs de frames para futuros fallos de navegación.

Los ensayos usan el catálogo empaquetado y datos desechables. La integración de Administración usa el usuario PostgreSQL de la aplicación y HTTP real; no sustituye respuestas del servidor. Para ejecutarla mientras corría Maven se reutilizó el JAR existente tras comparar sus 202 archivos de clases y recursos con `target/classes`: todos coincidieron. La campaña utiliza clics reales y expone el estado del motor solo para localizar elementos y observar resultados, sin forzar el progreso.

Se compararon, dentro de transacciones de solo lectura, cantidad y huella del contenido completo de `escenario` (11), `nivel_borrador` (10), `nivel_publicacion` (58), `nivel_publicacion_tarjeta` (399), `intento` (0), `diseno` (0) y `simulacion` (0). Coincidieron todas. Las cifras describen la instalación observada en esta auditoría, no un requisito sobre cuántas partidas debe tener el usuario.

## Cambios incluidos

- Presentación previamente solicitada: `frontend/src/administracion/AdministracionNiveles.js`, `frontend/src/administracion/administracion.css`, `frontend/src/interfaz/PictogramasMapa.js`. Aviso centrado, herramientas compactas, listas alineadas y distinción entre quitar POI y eliminar su regla.
- Pruebas: `frontend/tests/administracion-niveles-layout.test.cjs`, `frontend/tests/administracion-niveles-e2e.test.cjs`, `frontend/tests/red-referencia-nivel.test.cjs`, `frontend/tests/recorrido-integral-e2e.test.cjs`, `backend/src/test/java/com/metronet/backend/configuracion/ImpactoReglasAdministradasPostgresTest.java`.
- Este informe de verificación. No se modifica la documentación académica.
- Capas de producción afectadas: presentación. No se cambian servicios de negocio, endpoints, esquema ni datos personales.

## Límites de la evidencia

- Navegador probado: Chrome local. No se certifican Safari, Firefox u otros dispositivos físicos.
- Se enumeran combinaciones finitas de herramientas y objetivos; no existe una prueba de todas las redes, textos y secuencias imaginables.
- La publicación de cada campo hasta el jugador se recorre en E2E sobre Nivel 1; edición/persistencia cubre los diez y publicación/evaluación de los diez tiene pruebas PostgreSQL adicionales.
- Las fuentes externas de las tarjetas se comprueban como URL válida; esta auditoría no revisa su disponibilidad ni exactitud académica.
- No se publican borradores personales para probarlos. Su integridad se verifica por huellas de lectura antes/después.

## Reproducción

Requiere Java 21, PostgreSQL, Node, Chrome/Playwright y Vite de pruebas en `127.0.0.1:5198`. Usar el módulo instalado mediante `METRONET_PLAYWRIGHT_PATH` y `METRONET_BROWSER_CHANNEL=chrome`.

```sh
bash backend/scripts/probar-postgres.sh -DfailIfNoTests=true
METRONET_E2E_RECORRIDO=true bash backend/scripts/probar-postgres.sh -DfailIfNoTests=true
bash backend/scripts/probar-postgres.sh -Dtest=ImpactoReglasAdministradasPostgresTest
bash backend/scripts/probar-postgres.sh --administracion-e2e
METRONET_E2E_RECORRIDO=true bash backend/scripts/probar-postgres.sh -Dtest=RecorridoIntegralE2EPostgresTest
METRONET_URL_PRUEBAS=http://127.0.0.1:5198 node --test --test-concurrency=2 frontend/tests/administracion-niveles-layout.test.cjs frontend/tests/criterio-uv-ut.test.cjs frontend/tests/red-referencia-nivel.test.cjs frontend/tests/constructor-red.test.cjs frontend/tests/interaccion-directa.test.cjs frontend/tests/tarjetas-educativas.test.cjs frontend/tests/campana-educativa.test.cjs
npm --prefix frontend run build
git diff --check
```
