# Asignación musical de METRONET — 03/10/2026

## Alcance y estado

**DEFINIDO:** se conserva la arquitectura cliente-servidor y la separación de presentación, negocio y datos de Documento METRONET. La actualización musical solicitada el 3 de octubre sustituye el reparto de canciones de la solicitud anterior.

**IMPLEMENTADO:** el gestor existente continúa siendo la única autoridad de audio. El contenedor persistente conserva el reproductor al navegar; las pantallas reutilizan `ClienteMusicaPersistente`. No se modifican autenticación, permisos, reglas de juego, niveles, backend, API, entidades ni PostgreSQL. Solo se actualizan recursos, asignaciones y estimaciones de duración de las presentaciones existentes.

**PROPUESTO:** no se incorpora otro gestor, dependencia ni sistema de reproducción. La evaluación auditiva subjetiva y otros navegadores quedan fuera de la evidencia automatizada descrita aquí.

Se consultaron las reglas de `AGENTS.md` y la skill canónica `.agents/skills/metronet-development/SKILL.md`, la arquitectura documentada y los consumidores reales de música. No existe un archivo separado `METRONET-SKILL.md`. Este informe registra implementación y pruebas; no modifica el documento académico ni reconcilia silenciosamente informes históricos.

## Canciones vigentes

| Pantallas / contexto | Archivo suministrado | Recurso único | Duración de metadatos | Reproducción |
| --- | --- | --- | ---: | --- |
| Acceso, registro y recuperación; Editor, niveles en edición, Simulación y subtransiciones de gameplay (`auth`, `gameplay`, `transition`) | Extra.mp3 | `/audio/extra-theme.mp3` | 32,052208 s | Bucle |
| Inicio, Escenarios, Ranking, Mis Diseños, Perfil, selector sin diseño y Administración con todas sus pestañas (`menu`, `admin`) | Menus.mp3 | `/audio/menu-theme.mp3` | 13,139583 s | Bucle |
| Tren y logo después de un login válido (`welcome`) | AnimacionInicio.mp3 | `/audio/welcome-theme.mp3` | 32,574694 s | Una reproducción |
| Presentación de entrada y finalización de nivel, incluido su cartel NIVEL (`inicioNivel`, `victory`) | FalsaCargaDeVictoria.mp3 | `/audio/victory-theme.mp3` | 13,766500 s | Una reproducción |

`loading` y `general` mantienen su significado interno, sin una pista adicional. Compartir Extra entre acceso y edición no comparte autorización: el contexto de acceso sigue siendo `auth`, y el juego exige sesión.

## Duración y continuidad

- El final real del MP3 (`ended`) gobierna la salida normal de las presentaciones. La carga inicial no consume parte de la canción.
- El reloj visual existente adapta la misma escena al progreso real del audio. La bienvenida usa una estimación de 32575 ms; intro/outro de nivel comparten 13767 ms en `ConfiguracionTransicion.js`. No se modifica la velocidad física de simulación ni las horas didácticas.
- La presentación de nivel y el cartel forman una sola reproducción, sin reiniciar entre fases. El botón existente para continuar permite saltar voluntariamente; no se elimina ese control.
- Sin sonido o con archivo fallido, intro/outro mantienen aproximadamente 13,77 s con el respaldo existente. La bienvenida conserva su salida de respaldo breve y su alternativa para movimiento reducido, de modo que un fallo visual o de audio no retenga el acceso.
- Editor ↔ Simulación continúa con el mismo objeto y posición. Menú ↔ Administración comparte Menus, y las pestañas administrativas no reinician la pista.
- Se conserva la mezcla global de 180 ms solo entre archivos diferentes. Tras ella queda un canal; pueden coexistir brevemente dos durante la mezcla. No se crea una instancia por escena.
- Volumen, silencio, bucles y preferencias siguen perteneciendo al gestor existente. Recargar completamente el navegador todavía reconstruye el reproductor y recupera la posición; esta tarea no altera esa limitación. La navegación interna conserva el reproductor.

## Archivos de audio y limpieza

Los cuatro MP3 se copiaron sin recortar, recodificar ni cambiar volumen o metadatos. Se verificó igualdad binaria con los originales y con los recursos emitidos por el build. Los cuatro responden HTTP 200 como `audio/mpeg` con los bytes correctos.

| Recurso | Bytes | SHA-256 |
| --- | ---: | --- |
| `extra-theme.mp3` | 769311 | `af336b15ee63b47a276b3ba8394df8d0f69e3fa0d569adcea4ea813e5a2916e2` |
| `menu-theme.mp3` | 315408 | `88a7520c83a947802ab0718b41b2a7d6f1e33147b104008ce8164f37b24bc755` |
| `welcome-theme.mp3` | 521447 | `3655afaa5249e57e9f5254bfdc8ca97aa9cdbfdb0d72b3f706cf56ec51705b70` |
| `victory-theme.mp3` | 330454 | `5ca5250f776009466b80ac385af8e1e554e9b06dfe43dd7d3dd49458c38be2a9` |

Se retiraron los antiguos recursos `auth-theme.mp3` y `gameplay-theme.mp3`, sin referencias restantes en frontend o pruebas. Sus versiones anteriores siguen en Git. El recurso administrativo preparado en el intento anterior, aún sin publicar, no se incorpora: Administración utiliza Menus según la última solicitud. Se conserva `stage-start.mp3` como recurso histórico ajeno al reemplazo actual. No se modifican los archivos originales del escritorio ni el logo.

## Cambios de código y pruebas

Código productivo limitado a:

- `frontend/src/audio/ConfiguracionAudio.js`: reparto de las cuatro canciones, compartiendo Extra y Menus por contexto.
- `frontend/src/audio/AudioBienvenida.js`: estimación de la duración de AnimacionInicio.
- `frontend/src/educacion/ConfiguracionTransicion.js`: estimación común de FalsaCargaDeVictoria.
- Recursos de `frontend/public/audio` descritos arriba.

Pruebas actualizadas: `musica-contextual`, `musica-autenticacion`, `musica-bienvenida`, `musica-inicio-nivel`, `musica-victoria`, `duracion-musical-nivel`, `contenedor-persistente`, `continuidad-musical`, `reanudacion-temprana`, `reanudacion-produccion`, `bienvenida-acceso`, `identificacion-nivel`, `consultas-concurrentes` y `estabilidad-mapa`. Las posiciones de prueba se ajustan a canciones más cortas; los límites de las presentaciones reflejan la duración nueva. Consultas concurrentes y estabilidad de mapa solo actualizan referencias al recurso compartido.

Antes de sustituir los archivos, las dos comprobaciones nuevas de duración fallaron contra los recursos anteriores. En la primera ejecución enfocada, 59/60 casos pasaron; la prueba restante suponía que login y gameplay tenían archivos distintos. Se corrigió para verificar el contexto `auth` tras logout, preservando la comprobación de pausa, limpieza de posiciones y acceso seguro.

También se corrigieron dos supuestos temporales de las pruebas existentes: observar el tren solo 350 ms después de comenzar su viaje ya no garantiza que haya salido del túnel cuando la canción dura 32,57 s; ahora se esperan sus píxeles visibles. Adelantar el reloj 15 s saltaba por encima de la celebración breve posterior a una canción de 13,77 s; ahora se avanza hasta el final configurado más 50 ms. No fue necesario modificar la animación, navegación o celebración para resolverlos.

## Resultados de verificación

Ejecución con `node --test --test-concurrency=1`, Chrome y el runtime Playwright disponible en esta Mac. Sin dependencias nuevas.

| Grupo | Resultado observado |
| --- | --- |
| Continuidad, bienvenida musical, contexto, intro y reanudación temprana | 60 casos; 59 pasaron inicialmente. El caso de logout corregido pasó en la regresión siguiente. |
| Contexto, autenticación, contenedor persistente, duración con carga lenta, victoria, build servido, identificación, consultas y mapa | 131 casos; 130 pasaron inicialmente. La celebración final con reloj actualizado pasó en la comprobación posterior. |
| UI de bienvenida seleccionada: ambos roles, 320/1920 px, movimiento reducido, import lento, tren y resize | 8 casos; 7 pasaron inicialmente. La inspección del tren corregida pasó después. |
| Comprobación posterior de tren, doce cambios de menú y celebración final | **3/3 correctos**, sin fallos ni omitidos. |
| Comprobación final completa de continuidad y reanudación temprana | **16/16 correctos**, sin fallos ni omitidos. |
| Build de producción | Correcto, **2,94 s**, sin advertencias emitidas. También pasó la prueba del build servido con carga demorada de JavaScript/CSS. |
| Recursos y diff | Cuatro MP3 idénticos a los originales y al build; HTTP 200; sin referencias ejecutables a pistas retiradas; `git diff --check` correcto. |

Estos grupos tienen casos compartidos; no se suman como un total de pruebas únicas. Los fallos iniciales descritos quedaron corregidos y reejecutados. No se ejecutó toda la suite del proyecto ni tests backend: el cambio es de recursos y configuración frontend, sin modificaciones backend. El paquete frontend no define un comando de lint.

Se confirmó el final natural de bienvenida en JUGADOR y ADMIN, sin segundo login; intro y outro de 13,77 s, tanto normales como con seis segundos de demora de descarga; continuidad en el cartel de nivel; salida anticipada voluntaria; recuperación ante audio ausente, autoplay bloqueado, silencio y reproducción detenida; volumen y bucles; navegación, historial y permisos; ausencia de acumulación de canales/listeners en ciclos repetidos. Las pruebas de mapa, cámara y consultas también pasaron.

Las pruebas usan Chrome real y MP3 reales, con respuestas de API controladas; no crean cuentas ni modifican datos productivos. Los casos de archivo ausente y autoplay bloqueado producen errores de forma deliberada y verifican recuperación sin bloquear la pantalla. No se pretende certificar la escucha subjetiva en altavoces/auriculares ni la reproducción en Safari/Firefox.
