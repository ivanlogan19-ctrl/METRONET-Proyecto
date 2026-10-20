# Recorrido e inventario para completar el manual

Este archivo es una guía de producción de la muestra. **No es documentación oficial.**

## Estado de la evidencia

- **IMPLEMENTADO:** la versión del repositorio incluye el tutorial del editor, herramientas de Estación, Línea, Conexión y Metro, y controles Guardar, Simular y Finalizar red. Fuentes: `frontend/src/educacion/TutorialInicial.js`, `frontend/src/educacion/PanelTutorialInicial.js`, `frontend/simulacion.html` y las capturas indicadas abajo.
- **DEFINIDO:** en esta muestra no se cotejó cada paso con el Documento METRONET. No debe presentarse el diseño de estas dos páginas como formato oficial ya adoptado.
- **PROPUESTO:** usar una secuencia práctica con marcadores numerados y colores sobre controles exactos. Las dos páginas del PDF permiten validar ese formato antes de producir el manual completo.

## Recorrido práctico del Nivel 1

| Orden | Qué explicar y demostrar | Captura disponible |
|---|---|
| 1 | Entrar en Niveles, elegir Nivel 01 y leer la consigna | `6.58.35`, `7.00.44` |
| 2 | Iniciar el nivel; aceptar o volver a abrir el tutorial | `7.00.53`, `7.00.57`, `7.01.02` |
| 3 | Consultar las metas y ubicar dos estaciones en lugares distintos | `7.01.02`; el tutorial describe el clic en el mapa |
| 4 | Crear la línea eligiendo origen y destino | `7.01.02`, `7.01.14` |
| 5 | Explicar Conexión como extensión de una línea, cuando se necesite | `7.01.02`; `TutorialInicial.js` explica la selección |
| 6 | Asignar un Metro al pulsar una vía | `7.01.02`, `7.01.14` |
| 7 | Guardar el avance, incluso si la red está incompleta | `7.01.17` |
| 8 | Abrir Simulación y pulsar **Iniciar** para ejecutar el recorrido | `7.01.22`, `7.01.32`; botón `Iniciar` en `frontend/simulacion.html` |
| 9 | Volver a Edición y usar Finalizar red para comprobar la aprobación | Bandera visible en `7.01.02` y `7.01.14`; reglas en `6.58.45`, `6.58.48` |

**Comprobación pendiente:** las capturas recibidas no muestran con claridad una ejecución de simulación terminada ni la pantalla de resultado tras pulsar Finalizar red. Para ilustrar esos pasos con el mismo nivel de precisión hace falta capturarlos en una sesión de prueba. La captura `7.01.14` muestra la meta de conexión cumplida junto con la línea inicial; no afirmar que el jugador deba añadir una segunda conexión en Nivel 1 sin verificar las reglas de ese escenario.

## Elementos que debe cubrir el manual de usuario

- Acceso: registro, privacidad, inicio de sesión, recuperación, perfil y cierre de sesión (`6.57.18` a `6.58.29`).
- Navegación: Inicio, Niveles, Aprendizaje, Reglas, Ranking, Mis diseños y menú de cuenta (`6.58.11`, `6.58.15`, `6.58.35`, `6.58.38`, `6.58.42` a `6.59.03`).
- Preparación del nivel y tutorial: oferta inicial, guía paso a paso, control para reabrirla, ayudas contextuales y tarjetas educativas (`7.00.44` a `7.01.02`, `7.01.32`).
- Editor: metas, mapa, estaciones, líneas, conexiones, Metro, selección y edición, zoom, orientación, Guardar, Simular y Finalizar red (`7.01.02`, `7.01.14`, `7.01.17`). Cada icono debe llevar una referencia visual y una explicación de qué hace, cuándo se usa y qué clic sigue.
- Simulación: entrada, Iniciar, Pausar, Reanudar, Detener, Reiniciar, duración UT, ritmo, progreso y regreso a Edición. Los controles constan en `frontend/simulacion.html`; falta captura del panel sin modal para anotar todos.
- Después del juego: Mis diseños, Aprendizaje, Reglas, Ranking y Modo Libre (`7.02.05`, `7.02.08`, `6.58.38` a `6.59.03`, `7.01.52`).

## Elementos que debe cubrir el manual de administrador

- Acceso administrativo, menú y navegación lateral (`6.57.24`, `6.59.18`).
- Usuarios: búsqueda, filtro de rol, selector por fila, Guardar, Editar y Eliminar (`6.59.10`).
- Diseños y actividad: supervisión y acciones disponibles (`7.02.19` y capturas correspondientes).
- Experiencia de juego: lista de niveles, Desafío, Metas y POI, Reglas, Red de referencia, Tarjetas, Vista previa, Historial, Guardar y Publicar (`6.59.18` a `6.59.51`).
- Fuentes del mapa, Unidades y equivalencias, Configuración y música (`7.00.19`, `7.00.22`, `7.00.28`, `7.00.34`).

Las capturas originales conservan la barra del navegador. Para el manual se recortan **solo al maquetar** y se dibujan referencias vectoriales encima; no se altera ningún PNG original.
