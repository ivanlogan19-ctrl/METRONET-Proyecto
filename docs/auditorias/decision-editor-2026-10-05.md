# Decisión posterior sobre Proyecto y Actividad propia

Este documento complementa `PAQUETE_EDITOR.md`; no altera el patch congelado ni el Documento METRONET original.

## Evidencia de la decisión del usuario

Después de que el principal explicó que la vista previa retiraba del Editor la creación y actualización de escenarios, preguntó expresamente si se confirmaba eliminar esa función del Editor. El usuario respondió «sí» en dos mensajes posteriores y aclaró: «es que eso lo tengo en administración» y «en administración puedo editar los escenarios que sería niveles». El alcance confirmado es retirar **el acceso y los métodos del Editor**. No confirmó eliminar los endpoints, la gestión administrativa ni la entidad Escenario.

## Análisis de impacto

- **Requisitos y casos de uso:** Documento METRONET define Proyecto y la creación y gestión de escenarios basados en un diseño. El retiro del Editor cambia dónde se ofrece esa operación. No modifica por sí solo los requisitos de creación y gestión de escenarios en el documento académico.
- **Frontend:** `EditorRedMetro.js` deja de presentar Actividad propia y de llamar a `crearEscenario`/`actualizarEscenario`; `PanelHerramientasEditor.js` deja de presentar Proyecto. La Administración conserva `AdministracionNiveles.js`, cuyo flujo incluye guardar borrador, previsualizar, validar y publicar niveles.
- **Backend y API:** no se modifican `SimulacionController` ni `SimulacionService`, que aún exponen crear/actualizar escenario desde un diseño; `AdministracionNivelesController` conserva las rutas privadas de borrador, previsualización, publicación y versiones. Sin cambios de esquema o migraciones.
- **Permisos:** las rutas administrativas siguen verificando `obtenerAdministradorAutorizado`; el contenido de niveles comprueba sesión, desbloqueo y propiedad del intento. El Editor no añade permisos ni expone funciones administrativas.
- **Límite de alcance:** editar/publicar los diez niveles existentes en Administración **no equivale necesariamente** a crear escenarios libres o personalizados desde un diseño. Esa capacidad queda en la API, pero sin acceso desde el Editor en la vista previa. Resolver su ubicación final y actualizar la documentación oficial requiere una decisión documental aparte; no se infiere automáticamente de la aclaración del usuario.
- **Pruebas necesarias al integrar:** compilación frontend, entrada a Modo libre y niveles, Aprender 70/7, ausencia de Proyecto/Actividad propia en Editor, operaciones de edición y permisos; además, flujo real de guardar/previsualizar/publicar un nivel con administrador autorizado y regresión de API de escenarios si se pretende conservarla.

## Verificación independiente en copia temporal

- Las funciones locales `tarjetasDisponibles(1..10)` devuelven siete tarjetas por nivel; suma 70 para Modo libre. El componente compartido elige los diez niveles cuando `numero === null` y solo uno cuando recibe un número de nivel. En la vista IAB previa se había observado «Tarjeta 1 de 70» en Modo libre y «Tarjeta 1 de 7» en Nivel 1.
- Un API ficticio aislado sirve los diez niveles en `127.0.0.1:8297` y Vite está en `127.0.0.1:5297`; ambos se reiniciaron y verificaron escuchando solo en loopback.
- En una copia temporal del backend, con un repositorio Maven copiado dentro de esta tarea y sin escribir en `~/.m2`, pasaron 21 pruebas dirigidas: `AprendizajeServiceTest` (2), `JuegoEducativoServiceTest` (11), `AdministracionNivelesControllerTest` (5), `AprendizajeTrofeosHttpTest` (3). La prueba necesitó `-javaagent` local de Byte Buddy por la restricción de adjuntar agentes en este entorno y los recursos geográficos copiados del build base.
- La Administración tiene rutas y controles de guardar borrador, previsualizar y publicar; no se ejecutó su flujo completo contra PostgreSQL ni se publicó un nivel. La verificación de permisos es de pruebas MockMvc y servicios, no de una sesión administrativa real.

## Estado para integración

El usuario autorizó retirar la función **del Editor**. La Administración, API y permisos deben mantenerse. El parche fue aplicado en una copia aislada de integración desde `4aa2a6067cb9a36d587eac7ce923b97db8faa65d`, junto con QA v5, los incrementales QA v6/v7 y el lote de audio. Todavía no hay commit ni push al repositorio habitual. La discrepancia documental debe permanecer visible hasta una actualización oficial autorizada.

## Procedencia y gates de integración

Este registro procede de `DECISION_FORMAL_EDITOR.md` del paquete Editor (SHA-256 `849ce3316605c1573b0ce5505b523332d51e76644e5fed94bda223819c9d5f0e`). El Documento METRONET original no se modificó. FE053 se integró según la decisión posterior del usuario; la regresión focal v7 pasó 11/11 con API controlada, incluida la carrera con progreso demorado y error 503. La aceptación global todavía requiere la campaña educativa completa, los trofeos y las pruebas integradas pendientes; los resultados de la copia aislada no constituyen publicación.
