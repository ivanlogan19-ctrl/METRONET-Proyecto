# METRONET — matriz de cobertura del manual

## Criterio de estado

- **DEFINIDO:** Documento METRONET, fuente funcional y técnica principal. Sus capítulos de requisitos, casos de uso, administración y simulación establecen el alcance general.
- **IMPLEMENTADO:** interfaz y comportamiento observables en las 46 capturas aportadas y en los archivos del frontend citados abajo. Una captura documenta una vista; los flujos no capturados se contrastaron con código.
- **PROPUESTO:** no hay funciones propuestas presentadas como instrucciones del manual.

Esta matriz distingue la fuente de cada afirmación. El manual explica el comportamiento implementado de la versión observada; las diferencias con el documento oficial se registran al final.

## Cobertura por apartado

| Parte | Apartado detallado | Página PDF/DOCX | Evidencia visual | Estado de la explicación |
|---|---|---:|---|---|
| 1 Administrador | Ingreso y orientación del administrador | 3 | 6.57.24 | IMPLEMENTADO: captura y código |
| 1 Administrador | Usuarios: buscar, filtrar y cambiar rol | 5 | 6.59.10 | IMPLEMENTADO: captura y código |
| 1 Administrador | Usuarios: editar datos y eliminar | 6 | 6.59.10 | IMPLEMENTADO: código; vista interna no aportada |
| 1 Administrador | Diseños: localizar y abrir una red | 8 | 7.02.19 | IMPLEMENTADO: captura y código |
| 1 Administrador | Diseños: elementos y registro de Actividad | 9 | 7.02.19 | IMPLEMENTADO: código; vista interna no aportada |
| 1 Administrador | Experiencia de juego: flujo de trabajo | 11 | 6.59.18 | IMPLEMENTADO: captura y código |
| 1 Administrador | Desafío: texto que recibe el jugador | 13 | 6.59.21 | IMPLEMENTADO: captura y código |
| 1 Administrador | Metas y POI: acciones y lugares objetivo | 14 | 6.59.24 | IMPLEMENTADO: captura y código |
| 1 Administrador | Reglas: cantidades, herramientas y condiciones | 16 | 6.59.27 | IMPLEMENTADO: captura y código |
| 1 Administrador | Red de referencia: edición y prueba privada | 17 | 6.59.30 | IMPLEMENTADO: captura y código |
| 1 Administrador | Tarjetas: contenido, imagen y fuentes | 19 | 6.59.33 | IMPLEMENTADO: captura y código |
| 1 Administrador | Guardar, previsualizar y publicar | 21 | 6.59.46 | IMPLEMENTADO: captura y código |
| 1 Administrador | Historial: versiones y limpieza | 22 | 6.59.51 | IMPLEMENTADO: captura y código |
| 1 Administrador | Fuentes del mapa y unidades del juego | 24 | 7.00.22 | IMPLEMENTADO: captura y código |
| 1 Administrador | Configuración: mantenimiento y música | 26 | 7.00.28 | IMPLEMENTADO: captura y código |
| 2 Usuario | Registro: cuenta y privacidad | 28 | 6.57.29 | IMPLEMENTADO: captura y código |
| 2 Usuario | Sesión y recuperación de contraseña | 30 | 6.57.41 | IMPLEMENTADO: captura y código |
| 2 Usuario | Inicio, menú de cuenta y perfil | 32 | 6.58.29 | IMPLEMENTADO: captura y código |
| 2 Usuario | Campaña: elegir nivel y leer la misión | 34 | 7.00.44 | IMPLEMENTADO: captura y código |
| 2 Usuario | Tutorial: guía guiada y ayuda contextual | 36 | 7.00.57 | IMPLEMENTADO: captura y código |
| 2 Usuario | Edición: construir el primer recorrido | 38 | 7.01.02 | IMPLEMENTADO: captura y código |
| 2 Usuario | Guardar y ejecutar el Nivel 1 | 40 | 7.01.22 | IMPLEMENTADO: captura y código |
| 2 Usuario | Modo Libre: red y capas territoriales | 42 | 7.01.52 | IMPLEMENTADO: captura y código |
| 2 Usuario | Mis diseños: recuperar y gestionar | 44 | 7.02.08 | IMPLEMENTADO: captura y código |
| 2 Usuario | Aprendizaje: tarjetas y fuentes | 46 | 6.58.38 | IMPLEMENTADO: captura y código |
| 2 Usuario | Reglas: puntos, aprobación y acciones | 47 | 6.58.42 | IMPLEMENTADO: captura y código |
| 2 Usuario | UV, UT, ranking y trofeos | 49 | 6.59.03 | IMPLEMENTADO: captura y código |

## Capturas incorporadas

Las 46 capturas originales aparecen en las páginas visuales: el recorte elimina la ventana del navegador y conserva la interfaz del juego. Algunas se repiten en las páginas detalladas para enfocar controles. No se inventó ninguna pantalla.

| Página visual | Captura principal | Capturas de apoyo |
|---:|---|---|
| 2 | 6.57.24 | 6.57.55, 6.59.18 |
| 4 | 6.59.10 | 7.02.19 |
| 7 | 7.02.19 | 6.59.18 |
| 10 | 6.59.18 | 6.59.21 |
| 12 | 6.59.21 | 6.59.24 |
| 15 | 6.59.27 | 6.59.30 |
| 18 | 6.59.33 | 7.00.48 |
| 20 | 6.59.46 | 6.59.51 |
| 23 | 7.00.19 | 7.00.22 |
| 25 | 7.00.28 | 7.00.34 |
| 27 | 6.57.29 | 6.57.33 |
| 29 | 6.57.18 | 6.57.41 |
| 31 | 6.58.11 | 6.58.15, 6.58.29 |
| 33 | 6.58.35 | 7.00.44, 7.00.48 |
| 35 | 7.00.53 | 7.00.57, 7.01.02 |
| 37 | 7.01.02 | 7.01.14, 7.01.17 |
| 39 | 7.01.22 | 7.01.32, 6.58.45 |
| 41 | 7.01.52 | 7.01.46, 7.01.49, 7.02.00 |
| 43 | 7.02.05 | 7.02.08 |
| 45 | 6.58.38 | 6.58.42, 6.58.45, 6.58.48 |
| 48 | 6.58.54 | 6.58.59, 6.59.03 |

## Fuentes de implementación revisadas

- `frontend/admin.html`: menú y paneles de Gestión, Juego y Sistema.
- `frontend/src/administracion/administracion.js`: usuarios, diseños, actividad, fuentes, unidades y configuración.
- `frontend/src/administracion/AdministracionNiveles.js`: editor de niveles, guardado, validación, publicación e historial.
- `frontend/src/administracion/EditorMetasNivel.js`: metas y lugares objetivo.
- `frontend/src/administracion/EditorRedReferenciaNivel.js`: red privada de comprobación.
- `docs/verificacion/experiencia-auditoria-integral-2026-10-09.md`: auditoría funcional de la experiencia editorial.
- `docs/Documento METRONET.docx`: alcance y requisitos definidos oficialmente.

## Diferencias y límites de evidencia

1. **Mantenimiento.** DEFINIDO: el documento oficial describe una restricción temporal de operaciones de jugadores que modifican diseños y simulaciones. IMPLEMENTADO/visible: la pantalla administrativa indica que los jugadores no podrán ingresar y los administradores conservarán acceso. El manual describe el texto implementado; la discrepancia requiere decisión del proyecto y no se corrige aquí.
2. **UV/UT en niveles.** IMPLEMENTADO: el ajuste de una línea recalcula la otra magnitud a partir de su distancia. La pantalla estática de Unidades y equivalencias afirma que son independientes en niveles. El manual advierte esta contradicción sin convertir una afirmación de interfaz en regla oficial.
3. **Capturas no aportadas.** No hay imagen del diálogo de edición de usuario, detalle interno de diseño, tabla de Actividad ni resultado final aprobado. Esas acciones se explican con la implementación y se marcan como tales; se usan capturas de navegación relacionadas.
4. **Cuenta de ejemplo.** Varias imágenes muestran una sesión administradora, en la que los diez niveles y los trofeos tienen un estado especial. El manual aclara que un jugador ve disponibilidad y marcas según su progreso.

## Verificación del entregable

- PDF final: 49 páginas apaisadas; fuentes Calibri y Calibri Bold incrustadas.
- DOCX editable: 49 páginas al convertirlo con LibreOffice headless para control visual.
- 46 de 46 capturas únicas usadas; imágenes del juego recortadas del navegador.
- Todas las páginas de ambos formatos revisadas mediante contactos visuales; se inspeccionaron detalles ampliados de administración y Nivel 1.
- No se modificaron código de producto, datos, esquema, endpoints ni documentación oficial.
