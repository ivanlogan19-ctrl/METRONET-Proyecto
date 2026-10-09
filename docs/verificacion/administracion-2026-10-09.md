# Verificación de Experiencia de juego — 2026-10-09

## Estado y alcance

IMPLEMENTADO: ajustes de presentación y edición de Administración, guardado con protección frente a respuestas tardías, limpieza de publicaciones antiguas sin uso y pruebas reproducibles. Esta evidencia no redefine las consignas ni las reglas de puntuación de METRONET.

DEFINIDO: se conserva la arquitectura de presentación JavaScript → HTTP/REST → Controller → Service → PostgreSQL. No se agregaron entidades, columnas ni relaciones. El documento académico preexistente se incorpora al repositorio sin editar su contenido.

## Cambios publicados

- `frontend/src/administracion/AdministracionNiveles.js`: secciones del editor, disquete para guardar, salida a selección de niveles, cantidades visibles, controles alineados, catálogo de imágenes, edición de listas, validación y estado editorial. Oculta las opciones retiradas de la interfaz conservando el contrato recibido. Las respuestas tardías de guardado/preview no validan ediciones posteriores.
- `frontend/src/administracion/administracion.css`: uso del espacio disponible, controles e iconos compactos, subtítulos grises uniformes y adaptación a distintos tamaños.
- `frontend/src/estilos/retro.css`, `frontend/src/interfaz/PictogramasMapa.js`: botón Editar amarillo e icono de salida.
- `frontend/public/assets/fondo-tunel-ladrillos.png`: fondo de Inicio aprobado.
- `backend/src/main/java/com/metronet/backend/controller/AdministracionNivelesController.java`, `backend/src/main/java/com/metronet/backend/service/AdministracionNivelesService.java`: limpieza transaccional de versiones sin uso, autenticación ADMIN, comprobación de versión esperada y registro de actividad.
- `backend/src/main/java/com/metronet/backend/configuracion/PreflightAdministracionNiveles.java`: arranque compatible con la limpieza de V1 sin uso; exige diez niveles vigentes completos.
- `database/020_limpieza_historial_niveles.sql`: permiso DELETE únicamente sobre las dos tablas de publicaciones. No borra datos ni cambia el esquema. Fue autorizado y aplicado anteriormente en la instalación local.
- Pruebas: `frontend/tests/administracion-niveles-layout.test.cjs`, `frontend/tests/administracion-niveles-e2e.test.cjs`, `frontend/tests/criterio-uv-ut.test.cjs`, `backend/src/test/java/com/metronet/backend/configuracion/AuditoriaExperienciaNivelesPostgresTest.java`, `backend/src/test/java/com/metronet/backend/configuracion/LimpiezaHistorialNivelesPostgresTest.java`, `backend/src/test/java/com/metronet/backend/controller/AdministracionNivelesControllerTest.java`.
- `backend/scripts/probar-postgres.sh`: opción `--administracion-e2e` que reutiliza el clúster PostgreSQL desechable y ejecuta el navegador contra Spring Boot real con el rol `metronet_app`.
- Documento y tres vistas previas HTML preexistentes incorporados sin edición de contenido.

## Evidencia fresca

| Comprobación | Resultado |
| --- | --- |
| Integración Chrome → Spring Boot → PostgreSQL efímero | 12/12, salida 0 |
| Interfaz y regresiones de referencia/UV-UT | 30/30, salida 0 |
| PostgreSQL y Controllers de Administración | 19/19, salida 0 |
| Compilación frontend | salida 0 |
| Empaquetado backend para la integración | salida 0; las pruebas se ejecutaron aparte |
| Sintaxis JS, CJS, shell y `git diff --check` | salida 0 |
| Comparación de huellas de datos locales antes/después | idénticas, salida 0 |

La prueba integrada incluye login ADMIN y llegada a Inicio; edición de cantidades, herramientas, UV/UT y las 70 tarjetas; cambio de imagen; rechazo HTTP 400 sin persistencia; guardado y reapertura de los diez niveles; rechazo de una referencia vacía; construcción de una referencia válida con clics en el mapa; revisión editorial obligatoria; dos publicaciones reales; cancelación y confirmación de limpieza; y lectura posterior del historial en PostgreSQL. Son once subcasos más su caso contenedor. No se sustituyen respuestas REST: el navegador redirige las solicitudes al puerto temporal del backend.

Las 19 pruebas del backend cubren, entre otros casos, las 32 combinaciones de herramientas y las 32 combinaciones de objetivos de simulación por nivel, límites inválidos, conflictos de revisión y conservación de versiones referenciadas por partidas o borradores. La prueba integrada usa los catálogos empaquetados en una base aislada, no una copia de las partidas personales.

La instalación local se consultó únicamente en modo READ ONLY. Las huellas de `escenario` (niveles), `nivel_borrador`, `nivel_publicacion` y `nivel_publicacion_tarjeta` coincidieron antes y después. No se publicaron contenidos ni se borraron versiones en esa instalación durante esta verificación.

## Reproducción

Configurar `METRONET_PLAYWRIGHT_PATH` con el módulo Playwright instalado y `METRONET_BROWSER_CHANNEL=chrome` cuando se utiliza Chrome local. El script requiere Java 21, PostgreSQL, Node y Python 3.

```sh
bash backend/scripts/probar-postgres.sh --administracion-e2e
bash backend/scripts/probar-postgres.sh -Dtest=AuditoriaExperienciaNivelesPostgresTest,AdministracionNivelesBorradorPostgresTest,ValidacionPublicacionNivelPostgresTest,LimpiezaHistorialNivelesPostgresTest,AdministracionNivelesControllerTest
```

Para las pruebas de interfaz, iniciar Vite en el puerto de pruebas y luego:

```sh
METRONET_URL_PRUEBAS=http://127.0.0.1:5198 node --test frontend/tests/administracion-niveles-layout.test.cjs frontend/tests/criterio-uv-ut.test.cjs frontend/tests/red-referencia-nivel.test.cjs
npm --prefix frontend run build
git diff --check
```

## Límites

- Navegador verificado: Chrome. No se volvió a comprobar Safari ni Firefox.
- Las combinaciones enumeradas cubren contratos finitos; no representan todas las redes ni todos los textos posibles.
- La publicación integrada completa se ensayó sobre Nivel 1; en los diez niveles se ensayaron edición y persistencia. El backend tiene cobertura adicional de publicación y UV/UT.
- Las vistas previas HTML preexistentes y el contenido del documento académico no fueron objeto de esta auditoría funcional.
- No se modificó la documentación académica para reflejar silenciosamente el código. El nuevo endpoint `DELETE /api/admin/niveles/{numero}/versiones/sin-uso?versionEsperada=N` debe incorporarse a la documentación académica/API cuando se autorice esa actualización.
