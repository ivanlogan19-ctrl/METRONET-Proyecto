# Continuidad musical entre pantallas — 27/09/2026

Informe técnico de ejecución. Documento METRONET no se modifica.

## Estado y autorización

- **DEFINIDO:** JavaScript/HTML/Phaser en presentación, arquitectura cliente-servidor por capas, permisos y persistencia en backend. El documento académico exige modularidad y respuesta adecuada; no define el contenedor musical implementado aquí.
- **CAMBIO FORMAL APROBADO:** después de la confirmación formal, el análisis de impacto y la aclaración de que todas las canciones se conservarían, el usuario autorizó la ejecución del cambio de audio.
- **IMPLEMENTADO antes:** un gestor por documento. Cada navegación destruía el reproductor y recuperaba su posición desde almacenamiento, con una interrupción entre ambos.
- **IMPLEMENTADO ahora:** un contenedor de presentación conserva el gestor mientras las pantallas HTML se cargan dentro de un iframe del mismo origen. No se migra a un framework ni se cambia el modelo, backend, API, permisos o simulación.

## Comportamiento

Las canciones y los archivos MP3 permanecen intactos. Acceso/registro/recuperación usan auth; bienvenida usa welcome; menús/administración usan menu; editor/simulación usan gameplay; las presentaciones de nivel conservan victory y su duración. La configuración musical existente sigue siendo la única fuente de asignaciones.

Si cambia la pantalla y continúa la misma pista, el objeto Audio sigue reproduciendo, sin play, pause, seek ni mezcla consigo mismo. Solo un cambio real de canción activa la mezcla existente de 180 ms, con un máximo de dos pistas distintas durante ese intervalo. Volumen, silencio y activación por gesto se controlan desde cada vista.

Cada documento libera sus suscripciones y contextos temporales al salir. Un callback tardío de una vista anterior no puede cambiar la canción. Los documentos conservados por el navegador recuperan sus suscripciones al volver. Editor y simulador mantienen su propio ciclo de vida; no se preservan escenas obsoletas dentro del contenedor.

## Navegación y seguridad

Se conserva el historial nativo compartido del iframe. El contenedor refleja la ruta y el título sin añadir una segunda entrada. Las direcciones directas, redirects de sesión, Atrás/Adelante, hashes, cambios de diseño y confirmaciones de salida siguen operativos. El arranque transmite a la primera vista si se trata de una recarga o de un regreso del historial, para conservar el comportamiento de tutoriales y carteles.

Una regresión detectó que la recarga completa perdía el desplazamiento de una tabla larga. Se conserva únicamente ruta, posición e instante de salida en sessionStorage de esa pestaña; se consume para la misma ruta al recargar/regresar, dentro de 30 segundos. No es progreso educativo ni persistencia de dominio. Atrás continúa usando el historial de cada documento.

El contenedor solo acepta las rutas conocidas del mismo origen. Las cabeceras del frontend permiten exclusivamente marcos del mismo origen (`frame-ancestors 'self'` / `SAMEORIGIN`); no se permite embeber desde sitios ajenos. El iframe habilita autoplay únicamente para el mismo origen y sigue respetando las decisiones del navegador. No se modifican las cabeceras, CORS ni contratos del backend.

Si falla la descarga del contenedor, se ofrece reintentar o abrir el HTML independiente de respaldo. Los HTML originales también conservan su funcionamiento independiente con `?documento=1`. Una recarga completa, cerrar la pestaña o usar ese respaldo puede interrumpir la reproducción; la continuidad garantizada por esta implementación corresponde a la navegación interna con el contenedor activo.

En otro hosting, replicar las cabeceras configuradas en `frontend/seguridad-http.cjs`. Un servidor que fuerce `X-Frame-Options: DENY` impedirá cargar las vistas dentro del contenedor. La política de ancestros requiere cabeceras HTTP y no puede sustituirse por una etiqueta meta.

## Corrección adicional comprobada

Al finalizar la carga asíncrona del simulador vacío se volvía a insertar el panel de ayuda/música en el mismo padre. Si ocurría entre pointerdown y pointerup, se perdía el clic. Se reprodujo reteniendo la respuesta de configuración, pulsando Música y liberando la carga antes de soltar el mouse. La prueba falló antes y pasó después de evitar la reinserción cuando el panel ya está en su destino. No se altera ninguna regla de simulación.

También se reprodujo un error intermitente de Chrome al aplicar transiciones nativas entre documentos dentro del iframe durante un redirect de permisos: 2 de 12 repeticiones fallaron visualmente, sin vulnerar permisos. El evento fallido no entregaba una promesa que pudiera capturarse desde la vista. La documentación de [Chrome sobre transiciones entre documentos](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document) describe su soporte en marcos principales. Se limita ese mecanismo al HTML independiente y se aplica una entrada CSS de 180 ms a las vistas contenidas, sin animación al solicitar movimiento reducido. La comparación controlada posterior pasó 12 de 12 redirects; se agregaron regresiones normales y con movimiento reducido.

## Evidencia de continuidad

Comparación local en Chrome, con MP3 reales, el mismo recorrido de doce cambios entre menús y API de prueba controlada:

| Medida | Documentos independientes | Contenedor persistente |
| --- | ---: | ---: |
| Objetos Audio creados durante el recorrido, incluido el inicial | 13 | 1 |
| Eventos playing registrados | 13 | 1 |
| Tiempo de pared observado | 5,208 s | 5,744 s |
| Avance de posición musical observado | 2,928 s | 5,753 s |

Es una muestra local, no una garantía de velocidad de navegación ni una medición acústica. Las pequeñas diferencias de reloj son esperables. La regresión de continuidad también conserva la identidad del objeto y comprueba ausencia de play/pause/seek durante los cambios y durante una respuesta HTML demorada.

## Validación

Suite general: **682/682 pruebas aprobadas, cero fallos y cero omitidas**, en 695,34 segundos. Después del último ajuste visual y las dos nuevas regresiones, **33/33 pruebas** de navegación, contenedor y HUD aprobadas en 90,99 segundos, sin fallos ni omitidas. No se suman ambos recuentos como si fueran pruebas distintas: el segundo conjunto repite los casos afectados y añade las dos regresiones visuales.

- Nueva suite del contenedor: continuidad, cambios de pista, preferencias, login/logout ADMIN y JUGADOR, login inválido, permisos, callbacks tardíos, historial, recarga, scroll, respaldo ante fallo, autoplay y responsive. Incluye intro/outro y cartel con el MP3 completo de aproximadamente 15 segundos, también con movimiento reducido.
- Pruebas anteriores de componentes y documentos: conservan sus HTML aislados mediante fixtures de prueba que omiten exclusivamente el bootstrap del contenedor. No se eliminan sus aserciones ni se confunden con pruebas del contenedor real.
- Build de producción aprobado, sin warnings; 17/17 recorridos del contenedor aprobados en el build definitivo. El mayor fragmento de Phaser conserva 410,15 kB sin comprimir.
- Matriz visual del build: 9 pantallas × 5 resoluciones (1920×1080, 1440×900, 1366×768, 1280×720 y 390×844), sin errores JavaScript ni overflow horizontal. Editor desktop/móvil inspeccionados visualmente; capturas fuera de Git.
- Integración con backend y PostgreSQL temporales: login, tres recorridos de ocho pantallas, lectura/guardado, diez simulaciones con resultados persistidos, configuración y logout. Cero errores JavaScript y cero fallos de red. Datos sintéticos; no se accede a datos reales para esta comprobación. No se repite la suite JUnit completa porque no hay cambios de backend.
- No hay comando de lint configurado. Se revisan diff, sintaxis y archivos incluidos; builds, capturas, registros temporales y credenciales quedan fuera de Git.

## Archivos y alcance

- `frontend/aplicacion.html`, `src/navegacion/ContenedorAplicacion.js`, `contenedor.css`: contenedor y respaldo visual.
- `public/iniciar-contenedor.js`, `respaldo-contenedor.js`, `transicion-pagina.js`, `transiciones-documento.css`, `src/navegacion/TipoNavegacion.js`, `src/estilos/navegacion-estable.css`: arranque, fallos, dirección/historial, recarga y transiciones según contexto.
- `src/audio/GestorMusica.js`, `ClienteMusicaPersistente.js`: autoridad musical compartida y ciclo de vida por vista.
- `src/educacion/InicioTutorial.js`, `IdentificacionNivel.js`, `IdentificacionPresentada.js`: consumir el tipo real de navegación sin alterar la regla educativa.
- `src/simulacion/simulacion.js`: evitar reinserción del HUD en su mismo padre.
- `vite.config.js`, `seguridad-http.cjs`: entrada compilada y marcos limitados al mismo origen.
- `tests/contenedor-persistente.test.cjs`, `poi-simulacion.test.cjs`, fixtures de soporte y siete suites de vistas aisladas: regresiones y separación explícita de ámbitos de prueba.

Backend, endpoints REST, PostgreSQL, entidades, datos reales, dependencias, logo y archivos musicales: **sin cambios**. El apartado de presentación/navegación del documento académico deberá reflejar el cambio formal; no se edita automáticamente en esta tarea.
