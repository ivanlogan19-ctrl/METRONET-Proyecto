# Distancias y conexiones por par — 23 de octubre de 2026

## Alcance y estado

- Solicitado: dejar sólo el cuadro «Distancia total», sin subtítulo «Líneas» ni etiquetas sobre las vías. Conservar tipografía pixelada, colores y paginación. Reducir el fondo amarillo de las flechas y quitar su relieve, sin reducir el triángulo.
- IMPLEMENTADO: el cuadro conserva la suma completa por línea. Se retiraron los elementos de texto sobre las vías y su cálculo de posición en cada cuadro de renderizado. Las flechas conservan el triángulo de 9 px, con fondo plano de 18 × 16 px.
- IMPLEMENTADO previamente y comprobado: una conexión por par de líneas, sin importar el orden de selección. A–B, B–C y A–C pueden coexistir. El servidor rechaza duplicados con HTTP 409 antes de modificar la red; no se cambió esa regla.
- DEFINIDO: este trabajo conserva la arquitectura, las identidades de línea y la relación distancia–UV–UT vigentes. No introduce una conexión con recorrido o metro propios.
- PROPUESTO: no se incorporan propuestas funcionales adicionales.

## Archivos

- `frontend/src/mapa/controles/MedicionDistancias.js`: sólo cuadro de totales; se elimina el trabajo por fotograma de las etiquetas.
- `frontend/src/mapa/controles/medicion-distancias.css`: cabecera única y botones pequeños sin relieve.
- `frontend/src/educacion/TutorialCalles.js`: explicación del cuadro y la distancia completa por línea.
- `frontend/tests/distancias-lineas-conectadas.test.cjs`: cuatro líneas con geometría del diseño 865; totales, UV/UT y recorrido completo del motor.
- `frontend/tests/medicion-rendimiento.test.cjs`: cuadro fijo dentro del mapa al cambiar zoom/giro, sin etiquetas ni escrituras repetidas en reposo.
- `frontend/tests/medicion-tramos-cercanos.test.cjs`: paginación de seis líneas, fuente, título centrado, colores y ocultación.
- `frontend/tests/lineas-conexiones.test.cjs`: construcción de los tres pares desde el editor y reapertura sin alterar estaciones o colores.
- `backend/src/test/java/com/metronet/backend/configuracion/ConexionesLineasPostgresTest.java`: distancias completas, guardar/reabrir UV/UT, tres pares y rechazo de duplicados directos e inversos.

## Verificación

- Chrome instalado: 14/14 pruebas aprobadas entre las tres pruebas de medición y `lineas-conexiones.test.cjs`.
- Firefox oficial (`moz-firefox`): las mismas 14/14 aprobadas.
- Tras reducir y aplanar las flechas: repetición del caso de cuadro y paginación, 1/1 en Chrome y 1/1 en Firefox, más inspección de ambas capturas.
- Inspección visual de capturas de edición y simulación en ambos navegadores: cuadro centrado, pixelado y sin etiquetas sobre las vías.
- PostgreSQL temporal aislado, Java 25: `ConexionesLineasPostgresTest`, `ConexionesLineasServiceTest`, `DistanciasRedServiceTest` y `VinculoUvUtLibreTest`: 20/20, sin fallos ni omitidas.
- Compilación del frontend correcta. Aviso existente de atributos de importación JSON inconsistentes para `catalogo-svgs-niveles.json`; no impide compilar y no se modificó en esta tarea.
- `git diff --check`: salida 0, sin errores de espacios.
- El backend local responde `UP`, con base de datos `CONNECTED`; el frontend local responde HTTP 200. La primera consulta de disponibilidad utilizó por error `/api/escenarios`, que no es una ruta del sistema, y devolvió 500; la comprobación válida fue `/api/health`.

## Límites

Las pruebas del navegador utilizan la interfaz y motor reales con respuestas API controladas. Las pruebas de persistencia usan PostgreSQL aislado. No se modificaron partidas reales, esquema, migraciones, endpoints ni código de producción del backend. No se repitió la campaña completa de diez niveles ni se certificó Safari. El documento académico no se modificó.
