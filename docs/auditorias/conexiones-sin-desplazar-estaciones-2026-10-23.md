# Conexiones sin desplazar estaciones — 23/10/2026

## Estado y alcance

- DEFINIDO: el documento académico mantiene su versión previa; esta revisión no lo modifica.
- Aclaración del usuario aprobada para los diseños 843/844: unir líneas ya construidas prolonga la primera hasta la segunda, conservando ambas estaciones. Sustituye la fusión descrita en la revisión v9; no vuelve a introducir vías, metros ni UV/UT independientes para conexiones.
- IMPLEMENTADO: la conexión añade un tramo a la primera línea, comparte la estación de destino y conserva todos los puntos y tramos existentes. Se mantiene el color y la unidad de cada línea. La nueva longitud participa en el cálculo habitual UV/UT.
- Continuar una línea que termina en una conexión ya guardada funciona en ambos órdenes de clic, sin crear otro color. Si hay varios extremos posibles, se elige la vía sobre el mapa.
- No se permiten bifurcaciones dentro de una misma línea. Para prolongar una línea ya construida se selecciona primero su extremo; el destino puede ser una estación intermedia de otra línea.

## Datos, metas y tutoriales

No se cambia el esquema ni se agregan endpoints o dependencias. La operación usa la transacción y el bloqueo del diseño existentes. Ya no elimina estaciones ni reescribe sus tramos.

El catálogo v10 conserva las cinco metas y las cantidades aprobadas de los diez niveles, pero cuenta estaciones físicas, sin sumar créditos por fusión. Las líneas pueden prolongarse para conectar con otra; las condiciones de longitud mínima siguen aceptando esos recorridos. Las referencias de publicación construyen primero las líneas separadas y después agregan las prolongaciones. Se ajustaron tutoriales, ayuda y glosario para explicar ese gesto.

Se mantiene soporte de lectura de contratos anteriores. Los intentos abiertos de la campaña actual v7/v8/v9 sin contrato UV/UT antiguo pueden adoptar el catálogo nuevo con archivo previo; los completados, sus resultados, puntajes y desbloqueos no se reescriben.

Los diseños personales 843 y 844 se consultaron sin modificarlos para probar. La estación ya eliminada por la fusión anterior en 844 no tiene una posición original recuperable en su estado actual: esta revisión no inventa una posición ni mueve su red para reconstruirla.

## Archivos y capas

- Negocio/persistencia: `ConexionesLineasService.java`, `ConexionesLineasRepository.java`, `RecorridoIntegralService.java`, `RecorridoIntegralRepository.java`.
- Editor: `frontend/src/mapa/controles/CreacionDirecta.js`.
- Educación: `recorrido-integral.json`, `TutorialInicial.js`, `PanelTutorialInicial.js`, `RecorridoInicial.js`, `FuncionesCampana.js`, `AyudaContextual.js`, `glosario/Conceptos.js`.
- Pruebas: `ConexionesLineasServiceTest.java`, `ConexionesLineasPostgresTest.java`, `RecorridoIntegralPostgresTest.java`, `lineas-conexiones.test.cjs`, `recorrido-integral.test.cjs`, `recorrido-integral-e2e.test.cjs`, `soporte/editor.cjs`.

## Evidencia

- Reproducción previa: los dos casos de continuación del diseño 843 fallaban por no enviar la extensión. La prueba PostgreSQL de líneas paralelas fallaba porque desaparecía una de las cuatro estaciones. Se corrigió el código después de reproducir ambos fallos.
- Java 25/PostgreSQL aislado: conexiones, publicación/adopción de contratos y matriz de puntuación de los diez niveles: 31 pruebas, 0 fallos, 0 errores, 0 omitidas; salida 0. Log `/tmp/metronet-extension-postgres.log`.
- Catálogo: 14 pruebas aprobadas, salida 0. Log `/tmp/metronet-extension-catalogo.log`.
- Compilación frontend: salida 0; advertencia no bloqueante sobre atributos de importación JSON ya existentes. Log `/tmp/metronet-extension-build.log`.
- Un primer ensayo Firefox coincidió con una recarga de Vite durante los cambios de código y falló al seleccionar Eliminar; se repite con el código estable. No se cuenta ese ensayo como aprobado.

## Límites

No se prueba Safari ni toda la suite del repositorio en esta revisión. Las pruebas de navegador usan sesiones aisladas y audio silenciado, no la ventana personal del usuario. El documento académico necesita una actualización autorizada de la semántica de Conexión y del conteo de estaciones.

## Navegadores con el código estable

- Chrome: 41/41 pruebas de conexiones y tutoriales, 0 fallos/omisiones; salida 0. `/tmp/metronet-extension-chrome.log`.
- Firefox oficial: 41/41 de las mismas pruebas, 0 fallos/omisiones; salida 0. `/tmp/metronet-extension-firefox.log`. Incluye ambas direcciones de clic para continuar la conexión reabierta, conservación de las estaciones al prolongar y bloqueo/introducción de Conexión en N4.

## Campaña completa

Firefox + Java 25 + PostgreSQL aislado: los diez niveles se construyeron, guardaron, simularon, cerraron y reabrieron desde el navegador. Diez aprobaciones con 100 puntos, cinco metas por nivel, POI y UV/UT conservados; acceso final a Modo Libre. Resultado: 11/11 comprobaciones de navegador y 1/1 prueba Java envolvente, sin fallos ni omisiones, salida 0. Duración Maven: 7:05 minutos. Logs `/tmp/metronet-extension-campana-firefox.log` y `/tmp/metronet-extension-campana-firefox-browser.log`.

## Actualización local

- Respaldo privado previo: `.local/respaldos/conexiones-sin-fusion-v10.Z6nPua/metronet.dump`; creación y lectura del índice con salida 0. No se ensayó restauración.
- El servidor local arrancó con Java 25 y publicó los diez niveles v10 mediante el validador existente a las 20:24 del 23/10/2026. SQL confirma diez publicaciones vigentes v10; frontend y backend responden HTTP 200.
- Las huellas antes/después son idénticas para usuarios, intentos (excepto el vínculo intencional de publicación), simulaciones, diseños, estaciones, líneas, paradas, tramos, metros y conexiones; comparación con salida 0. Consulta y resultados privados junto al respaldo. No se alteraron las redes 843/844.
- No se agregaron migraciones ni endpoints. Los contratos educativos abiertos elegibles sí se actualizaron de manera intencional; el historial completado permanece protegido.
- La revisión v9 anterior ya fue publicada en ambas ramas en `4b3b400`; esta revisión incorpora la aclaración posterior. Las comprobaciones de Git se realizan después del commit y no se confunden con los resultados de pruebas anteriores.
