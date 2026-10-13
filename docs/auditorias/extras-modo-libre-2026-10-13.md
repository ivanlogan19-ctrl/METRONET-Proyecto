# Extras de Modo Libre — 13/10/2026

## Alcance y estado

- **DEFINIDO por cambio formal autorizado:** siete tarjetas Extras, bienvenida, acceso propio junto a Aprender, paso del tutorial, progreso por jugador y premio oculto al recorrer las siete.
- **IMPLEMENTADO:** tarjetas horizontales con ilustraciones esquemáticas y fuente Silkscreen; biblioteca en Aprendizaje; ingreso, visitas y premio persistidos por servidor.
- **PROPUESTO / no adoptado:** vincular automáticamente UV y UT de forma inversa. Este trabajo no modifica sus controles ni el motor.

## Flujo y reglas

Al ingresar a una red de Modo Libre por primera vez en una cuenta, se registra el desbloqueo y se ofrece la bienvenida de Extras. Ver las tarjetas o saltarlas es voluntario. El tutorial del mapa se prepara después de terminar o cerrar Extras; si se obtiene el premio al finalizar, también se espera a cerrar su celebración. En aperturas posteriores se conserva el acceso desde el icono y Aprendizaje.

Una tarjeta cuenta cuando se confirma su recorrido con Anterior, Siguiente o Finalizar. Cerrar o saltar no añade la tarjeta actual. El servidor deduplica visitas, valida las siete claves, aísla cuentas y entrega una sola recompensa incluso ante solicitudes simultáneas. Los administradores consultan el material sin obtener premios, siguiendo el comportamiento vigente de los trofeos.

La biblioteca y el premio sobreviven al reinicio de campaña. Un error de persistencia no inventa progreso: permite reintentar o salir. La indisponibilidad del material no impide construir.

## Arquitectura y persistencia

Se mantiene JavaScript/Phaser → REST → Controller → Service → PostgreSQL. Extras reutiliza autenticación, diálogos, pictogramas, recorrido de ayuda y celebración de trofeos. La persistencia usa JdbcTemplate, como los servicios educativos existentes.

`database/022_extras_modo_libre.sql` añade `aprendizaje_extra_usuario` y `aprendizaje_extra_visita`, con claves foráneas a usuario y unicidad de tarjeta por jugador. La migración es idempotente. No se cambia el esquema de redes, estaciones, metros ni simulaciones.

Contratos autenticados nuevos:

- GET `/api/juego/aprendizaje/extras`
- POST `/api/juego/aprendizaje/extras/ingreso`
- PUT `/api/juego/aprendizaje/extras/bienvenida`
- PUT `/api/juego/aprendizaje/extras/tarjetas/{tarjeta}`

El catálogo de trofeos añade el sexto premio, cuyo nombre y requisito quedan ocultos hasta obtenerlo. Se preservan los cinco existentes.

## Corrección del entorno local

El mensaje de fallo comunicado por el usuario se reprodujo con el servidor antiguo: la ruta de Extras respondía 500 y las tablas nuevas no existían en `metronet_proyecto`. Se aplicó la migración 022 y se recompiló/reinició el arranque local. El servidor nuevo inicia correctamente, reconoce la ruta y devuelve 401 sin credenciales. Las dos tablas existen en PostgreSQL local.

También se espera el registro de ingreso antes de guardar una tarjeta al abrir Extras manualmente, para evitar una carrera entre ambas peticiones. Se eliminó el punto duplicado del mensaje de reintento.

## Evidencia

- `ExtrasModoLibrePostgresTest`, `AprendizajeTrofeosPostgresTest`, `TrofeosServiceTest`, `AprendizajeTrofeosHttpTest` más `CallesModoLibreE2EPostgresTest`: 8 pruebas, 0 fallos, 0 errores, 0 omitidas. Salida 0.
- Regresión completa de Modo Libre: 1 recorrido de navegador aprobado; construcción, capas, regla, simulación, recuperación desde PostgreSQL, tutorial y navegación por Reglas/Administración. Salida 0.
- Chrome con backend HTTP real y PostgreSQL temporal: 2 recorridos de Extras aprobados, incluidos omisión, recuperación, duplicados, fallo de escritura, premio y orden de presentación. Sin respuestas de negocio simuladas salvo el fallo de red deliberado.
- Vista comprobada en 1440×900, 1280×720 y 390×844. Las tarjetas de escritorio entran sin desplazamiento; fuente pixelada en todos sus elementos.
- Prueba de ranking y reintento independiente: 1 aprobada, salida 0.
- Compilación frontend y empaquetado backend: salida 0.

## Solicitud relacionada

Se retiró Fuentes del mapa de Reglas, conservando las fichas en Administración y ajustando el texto del tutorial. Las pruebas de navegación reflejan esa ubicación.

## Límites

Las cuentas de prueba se crearon en PostgreSQL temporal, no en la base personal. Se verificó el despliegue local y su esquema, pero no se manipuló la sesión abierta del usuario. No se modificó el documento académico principal: deberá incorporar las nuevas reglas y contratos en su próxima revisión. No se creó commit ni se publicó a Git en esta tarea.

## Archivos del alcance

- Base: `database/022_extras_modo_libre.sql`.
- Servidor: `backend/src/main/java/com/metronet/backend/controller/ExtrasModoLibreController.java`, `service/ExtrasModoLibreService.java`, `service/TrofeosService.java`, `configuracion/VerificadorEsquemaUvUt.java`.
- Tarjetas y presentación: `frontend/src/educacion/extras/{TarjetasExtras.js,ClienteExtras.js,PresentacionExtras.js,extras.css}`.
- Integración: `frontend/src/educacion/{PanelAyudaContextual.js,TutorialCalles.js,IconosTrofeos.js,ranking.js}`, `frontend/src/interfaz/PictogramasMapa.js`, `frontend/src/mapa/controles/{EditorRedMetro.js,PanelCalles.js}`.
- Biblioteca: `frontend/aprendizaje.html`, `frontend/src/navegacion/{aprendizaje.js,aprendizaje.css}`.
- Fuentes fuera de Reglas: `frontend/reglas.html`, `frontend/src/educacion/reglas.js`, comentario en `frontend/src/mapa/FuentesMapa.js`.
- Pruebas: `backend/src/test/java/com/metronet/backend/configuracion/{ExtrasModoLibrePostgresTest.java,AprendizajeTrofeosPostgresTest.java}`, `backend/src/test/java/com/metronet/backend/service/TrofeosServiceTest.java`, `frontend/tests/{extras-modo-libre-e2e.test.cjs,ranking-trofeos-independientes.test.cjs,calles-modo-libre-e2e.test.cjs}`.
- Trazabilidad: este informe. Los cambios previos de música, Inicio y Administración permanecen separados de este alcance.

Durante la regresión de construcción se detectó que actualizar una red después de añadir elementos volvía a solicitar el ingreso a Extras. Se limitó la oferta al cambio de diseño; las actualizaciones de elementos ya no consultan ese ingreso.
