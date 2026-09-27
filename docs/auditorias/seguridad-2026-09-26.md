# Auditoría de seguridad y recuperación — METRONET

Fecha: 26/09/2026 (Uruguay). Alcance: repositorio local, frontend, API Spring Boot, PostgreSQL local y referencias alcanzables del historial Git. Autorización: tarea de auditoría y publicación solicitada por el usuario. No se realizaron ataques a terceros ni pruebas destructivas sobre datos reales.

## Estado y trazabilidad

**DEFINIDO:** Documento METRONET establece autenticación, contraseñas protegidas, roles ADMIN/JUGADOR, propiedad de diseños, recuperación y arquitectura por capas. AGENTS.md exige configuración sensible externa, integridad y evidencia de pruebas. La tarea de auditoría añade comprobaciones explícitas de vencimiento, límites, dependencias y recuperación de respaldos. No se atribuyen al documento académico detalles que solamente existían en código (por ejemplo, las ocho horas de sesión).

**IMPLEMENTADO:** Java 21, Spring Boot 3.5, REST/JSON, PostgreSQL, JavaScript/Phaser/Vite. Se conserva esa arquitectura y el modelo relacional. Se corrigieron vulnerabilidades y configuración dentro del alcance autorizado. La documentación académica no se modificó.

**PROPUESTO, NO ADOPTADO:** 2FA; alternativa a tokens en localStorage; operación de producción con HTTPS y cabeceras del hosting; copias cifradas externas y política de retención. Ver [análisis de 2FA](seguridad-2026-09-26-2fa.md).

Requisito → componentes → evidencia:

- Autenticación/sesiones → AuthService, LimiteSolicitudes, PoliticaContrasena → AuthSeguridadTest y AuthServiceTest.
- Autorización/propiedad → Controllers + Services existentes → SeguridadPostgresTest y pruebas de mantenimiento.
- Recuperación → RecuperacionContrasenaService → pruebas unitarias y transacción real PostgreSQL.
- XSS/navegación → administración, login y bienvenida → seguridad-interfaz.test.cjs, reproducción antes y después.
- Cabeceras, límites y CORS → ConfiguracionCors, ProteccionHttp y configuración Vite → pruebas HTTP y navegador.
- Persistencia/recuperación → rol runtime y scripts locales → arranque de aplicación, copia restaurada y verificaciones de permisos.

## Hallazgos

Las severidades son valoraciones de esta revisión, considerando el entorno local. Los avisos de dependencias no equivalen por sí solos a una explotación comprobada.

| ID | Severidad | Hallazgo y evidencia | Impacto | Corrección / estado | Prueba |
|---|---|---|---|---|---|
| SEC-01 | Alta | `administracion.js` escapaba texto mediante `span.innerHTML` y lo reutilizaba en atributos con comillas. Un nombre de prueba añadió `onpointerover` y ejecutó un marcador inocuo. | XSS persistente al ver datos de usuarios/diseños; riesgo para sesión ADMIN. | Corregido: escape de `& < > " '` también en atributos; CSP adicional. | Caso de navegador falló antes (`marcador=1`) y pasa después; datos conservados como texto. |
| SEC-02 | Alta | Rol PostgreSQL usado por runtime era superusuario, con CREATEDB/CREATEROLE; HBA local admitía `trust`. | Compromiso de la aplicación amplía acceso a administración de BD; acceso local sin contraseña. | Corregido: rol limitado, SCRAM/peer, sin trust, rol histórico retirado del login; detalle abajo. | Arranque auxiliar con rol nuevo y validación de esquema. |
| SEC-03 | Alta | Contraseña literal de PostgreSQL en blob histórico `6271e7e00ff7`, archivo `application.properties`, commit `4996bd0`. No se reproduce el valor. | Una credencial reutilizada debe considerarse divulgada. | Credencial runtime nueva; rol histórico sin LOGIN ni contraseña. Historial conservado; rotar cualquier reutilización externa. | Escaneo de 1.032 blobs de texto; revisión manual de los dos candidatos. |
| SEC-04 | Media | Login admitía intentos ilimitados y no calculaba BCrypt para usuarios inexistentes. | Fuerza bruta y diferencia observable entre cuenta existente/inexistente. | Corregido: seis intentos fallidos por identificador normalizado en 15 min; hasta 30 solicitudes públicas de autenticación por IP real/minuto; comparación ficticia BCrypt para cuenta inexistente. | Límite, normalización, vencimiento de ventana y cabecera IP falsa probados. |
| SEC-05 | Media | `destino` solo rechazaba `//`; una barra inversa permite normalización a otro origen. | Redirección externa después de un login válido. | Corregido: validación por URL normalizada, mismo origen y rechazo de barras inversas/controles, también al reanudar bienvenida. | Rutas locales válidas y seis variantes inválidas en navegador. |
| SEC-06 | Media | Respuestas sensibles sin política explícita de caché/encuadre; frontend sin CSP. | Persistencia indebida de respuestas, clickjacking y menor contención de inyecciones. | Añadidas cabeceras y CSP comprobada con Phaser. HTML construido incluye CSP; cabeceras de hosting requieren configuración al desplegar. | HTTP integrado, navegador y build. |
| SEC-07 | Media | `reenviarCodigo()` llamaba internamente al método transaccional, sin iniciar su propia transacción. | Fallo al bloquear la fila de usuario durante reenvío; recuperación inconsistente. | Corregido con frontera `@Transactional` en reenvío. | Service real, PostgreSQL real, sin transacción externa de test; envío de correo simulado. |
| SEC-08 | Baja | Contraseñas sin límite explícito de bytes para BCrypt; nombres/correos sin los límites básicos del modelo. | Error inesperado o truncamiento según encoder; mensajes inconsistentes. | Validación central de contraseña de hasta 72 bytes UTF-8; nombre/apellido de perfil hasta 100 y correo hasta 150. | Unicode, límite de 72 bytes y rechazo de exceso. |
| SEC-09 | Media | API sin límite explícito de cuerpo JSON. | Consumo evitable de memoria con cuerpos grandes. | 64 KiB antes de deserializar, incluso sin Content-Length; 16 KiB de cabeceras y timeout de conexión. | Rechazo 413 sin ejecutar Controller; cuerpo normal conservado. |
| SEC-10 | Media | Sesión común no verificaba que el rol siguiera coincidiendo con el que inició la sesión; fallback de contraseña plana durante login. | Sesión obsoleta tras modificación externa de rol; ruta de contraseña plana innecesaria. | Rol fijado al emitir sesión y comprobado en cada acceso. Login solo BCrypt; se conserva el migrador de credenciales legadas al iniciar. | Cambio de rol, usuario eliminado, token inventado, logout y ocho horas. |
| SEC-11 | Alta/Media según aviso | 44 avisos distintos publicados hasta la fecha sobre versiones Maven instaladas. | Depende de componentes/configuración: varios requieren JSP, AJP, WebDAV, tipos polimórficos u otras funciones ausentes. | Parches compatibles instalados; consulta OSV posterior sobre 94 coordenadas: cero avisos. | Árbol Maven y [evidencia por aviso](seguridad-2026-09-26-dependencias.json). |
| SEC-12 | Media | Una vista conservada del navegador no revisaba si la sesión local había sido cerrada/cambiada. | Mostrar datos de la cuenta anterior al restaurar la página, aunque la API ya rechazara el token. | Corregido: comprobación en pageshow/storage, ocultación inmediata y navegación única. | El evento de restauración conservaba Administración antes; ahora vuelve al login. Seis pruebas de seguridad/navegación correctas después. |

No se comprobó un bypass de autenticación, inyección SQL, ejecución remota o acceso cruzado en las rutas probadas. Esto no es una garantía de ausencia total de vulnerabilidades.

## Autenticación, permisos y datos

Sesiones opacas aleatorias de 32 bytes, codificadas en 43 caracteres URL-safe; no son JWT. Se conservan en memoria del servidor y vencen a las ocho horas. Logout invalida el token; cambio/recuperación de contraseña, cambio de rol y eliminación invalidan sesiones. Reiniciar el servidor exige volver a ingresar. Las sesiones expiradas se limpian al crear nuevas sesiones.

Registro siempre asigna JUGADOR; campos extra `rol`/`idUsuario` enviados por cliente no cambian identidad ni permisos. Las respuestas usan DTO sin contraseña/hash. No hay estado de usuario bloqueado/inactivo implementado: no se inventó un campo nuevo. Se conserva el conflicto por correo duplicado que utiliza el registro; por ello ese formulario sigue permitiendo inferir si un correo ya está registrado.

Se inventariaron [72 operaciones HTTP](seguridad-2026-09-26-endpoints.md). Administración exige token ADMIN; diseño/simulación comprueba propietario en Service. Un token de JUGADOR no sirve como token administrativo. No se consideran controles visuales una barrera de seguridad.

La prueba de aislamiento usa dos usuarios sintéticos: el primero intenta leer, guardar, validar, crear elementos, ejecutar, evaluar y eliminar el diseño del segundo (15 operaciones); recibe 404 y el diseño ajeno queda intacto. Las operaciones administrativas de lectura y escritura se rechazan sin sesión adecuada. Los casos existentes de mantenimiento verifican el bloqueo backend del JUGADOR y el acceso permitido del ADMIN.

Se revisaron consultas JDBC/JPA: IDs y valores se parametrizan. Se prueba entrada SQL inocua tanto en login como en nombre persistido; no se ejecuta como SQL. Las búsquedas geográficas son sobre catálogos locales, sin ejecución de consultas dinámicas remotas.

Recuperación: código aleatorio, hash BCrypt, caducidad de diez minutos, máximo de cinco errores, reenvío a partir de 60 segundos, autorización temporal aleatoria con hash y uso único. Las solicitudes iniciales responden de forma neutral. Los errores de verificación conservan el estado funcional existente (vencido/bloqueado/usado), lo que puede revelar que existe un proceso de recuperación para un correo conocido. Las pruebas no enviaron correos reales.

Se añaden eventos de login rechazado sin correo, contraseña, token ni payload. El historial administrativo existente registra operaciones sensibles; no se creó persistencia de auditoría adicional.

## Protección HTTP y frontend

- CORS centralizado: por defecto solo `http://127.0.0.1:5173` y `http://localhost:5173`; configurable con `METRONET_CORS_ORIGENES`, sin comodines, sin cookies y con Authorization/Content-Type. El filtro CORS precede al límite para permitir que el frontend lea 413/429.
- API: `no-store`, `nosniff`, `DENY`, `no-referrer`, Permissions-Policy, CSP restrictiva para respuestas JSON. HSTS solo si la petición llega por HTTPS real.
- Frontend: scripts del mismo origen, sin `unsafe-inline`/`unsafe-eval` para JavaScript; imágenes/audio locales y fuentes propias. Se permite CSS inline por el posicionamiento dinámico de Phaser. Vite dev/preview añade DENY/frame-ancestors. El build incluye CSP mediante meta; un hosting estático debe replicar las cabeceras de `frontend/seguridad-http.cjs`, ya que frame-ancestors no funciona mediante meta.
- El backend local se vincula por defecto a 127.0.0.1. Para otro despliegue deben declararse explícitamente dirección/orígenes/TLS; no se modificó infraestructura externa.
- Tokens permanecen en localStorage conforme al diseño actual. Un XSS futuro podría leerlos: CSP y corrección de sinks reducen el riesgo, pero no lo eliminan. Migrar a cookies HttpOnly requeriría evaluar CSRF, contratos y logout; no se realizó esa migración.

## Dependencias

| Componente | Antes | Después |
|---|---|---|
| Spring Boot | 3.5.14 | 3.5.16 |
| Spring Framework | 6.2.18 | 6.2.19 |
| Tomcat | 10.1.54 | 10.1.60 |
| PostgreSQL JDBC | 42.7.10 | 42.7.12 |
| Jackson | 2.21.2 | 2.21.5 |
| Logback | 1.5.32 | 1.5.34 |
| Log4j API/bridge | 2.24.3 | 2.25.5 |

La actualización del BOM también actualiza versiones compatibles gestionadas por Spring, documentadas en la evidencia. No se añadió framework ni dependencia funcional. Phaser/Vite permanecen; `npm audit` antes del cambio informó cero vulnerabilidades. Los límites de intentos están acotados a 10.000 claves y al proceso actual; se reinician con el servidor y no constituyen defensa distribuida. No se confía en X-Forwarded-For. Ante un despliegue con proxy debe revisarse su configuración antes de alterar la fuente de IP.

El build conserva la advertencia previa de tamaño del bloque que contiene Phaser; no es un fallo de seguridad ni de compilación.

Fuentes primarias consultadas: [avisos oficiales de Tomcat](https://tomcat.apache.org/security-10.html), [seguridad Spring](https://spring.io/security), [PostgreSQL 17](https://www.postgresql.org/support/security/17/), [API OSV](https://api.osv.dev/v1/querybatch) y POM oficiales de Maven Central. Por ejemplo, los parches de Tomcat 10.1.60 incluyen correcciones de HTTP/2; no se habilitaron protocolos nuevos para intentar reproducir avisos que no aplican al despliegue.

## Secretos y configuración

Escaneo de 1.032 blobs de texto alcanzables por referencias Git, con detección de claves privadas, tokens conocidos y contraseñas de configuración. Dos candidatos: una referencia a variable shell (falso positivo) y la contraseña literal histórica indicada en SEC-03. Ningún valor completo se copió a este informe. No se reescribió el historial. Si esa contraseña se reutilizó fuera de esta instalación, debe cambiarse allí también: no se auditaron otros servicios.

`.local/` está excluido de Git; contiene configuración privada y respaldo, con directorios 0700 y archivos 0600. `.env.example` contiene nombres de variables y valores no secretos. Las credenciales de correo existentes se conservaron localmente sin publicarlas. El usuario runtime y la contraseña nueva se leen del archivo privado mediante `backend/scripts/iniciar-local.sh`; primero debe existir el JAR construido. `iniciar-con-gmail.sh` también reutiliza esa configuración de BD.

## PostgreSQL local y recuperación

PostgreSQL 17.10, únicamente localhost. No se cambiaron tablas, columnas, relaciones ni migraciones. Hibernate ahora usa `validate` por defecto, no DDL automático con el rol runtime. El runtime tiene CONNECT, USAGE del esquema, operaciones de datos y uso/lectura de secuencias; no recibe propiedad de tablas ni SUPERUSER/CREATEDB/CREATEROLE.

**Estado de cambio de acceso local: aplicado y verificado**, después de autorización explícita del usuario. Se reemplazó primero el backend activo por el rol limitado y se comprobó ausencia de conexiones del rol antiguo. HBA exige SCRAM para TCP y autenticación peer para mantenimiento local; no quedan reglas trust ni errores de HBA. El rol runtime solo puede conectarse a metronet_proyecto. Pruebas: conexión con contraseña correcta aceptada; conexión sin contraseña rechazada; UPDATE permitido en transacción reversible; CREATE TABLE rechazado; administrador local de macOS conserva acceso. El rol histórico `logan` conserva propiedad de tablas pero tiene NOLOGIN y contraseña retirada. Las diez conexiones del backend activo utilizan `metronet_app`; health UP/CONNECTED en 127.0.0.1:8080. Se preservó el archivo HBA anterior en el respaldo privado. No cambia ninguna contraseña de cuenta METRONET. Si una herramienta externa usaba el rol técnico antiguo, debe actualizar su conexión.

No se localizó un procedimiento automatizado de respaldo en el repositorio. Se creó `backend/scripts/probar-recuperacion.py`: genera dump privado, levanta un clúster temporal con puerto aleatorio, restaura sin propietarios/ACL originales, compara conteos y huellas de todas las filas, verifica las claves foráneas y destruye únicamente el clúster temporal. Nunca restaura en la BD de origen. El script exige indicar explícitamente PGDATABASE.

Prueba realizada: 26/09/2026 21:03 Uruguay (27/09/2026 00:03 UTC); dump de 39.943 bytes, 13 tablas, 15 FK validadas, contenido restaurado idéntico por tabla. Restauración y comprobación: aproximadamente **0,53 segundos** para este conjunto pequeño. Respaldo: `.local/respaldos/metronet-20260927T000300Z.dump`. SHA-256 `a8b80ad0745b1a7a7458e551235a7a12a61309c6bc3e6ebcbc9d6fb5ad1b6d3d`.

Este tiempo no representa un RTO de producción. No hay RPO comprometido ni calendario de copias demostrado. La copia local no protege ante pérdida del disco y contiene datos privados; se necesita una decisión posterior sobre cifrado externo, retención y ubicación de respaldo. No se publicó ningún dump.

## Superficie ausente / NO APLICA

- Uploads y descargas privadas de archivos: no hay endpoints funcionales; recepción multipart deshabilitada. Assets geográficos/audio son archivos estáticos del proyecto.
- Webhooks, firma/replay de webhooks: no existen.
- SSRF por URL suministrada por usuario: no se encontró función backend de descarga arbitraria. SMTP usa configuración del servidor.
- Command injection: backend no lanza comandos derivados de solicitudes. Scripts de operación son locales y no están publicados como API.
- JWT/algoritmos de firma: sesiones opacas, no JWT.
- Actuator, Swagger, consola H2, endpoints de depuración: no incorporados/expuestos. Health público ofrece solo UP/CONNECTED.
- Deserialización polimórfica: DTOs concretos, sin activación de tipos arbitrarios.

## Verificaciones y límites

- Suite backend con PostgreSQL temporal: 193 pruebas, cero fallos/errores/omisiones. Después se amplió SeguridadPostgresTest a cinco casos y se repitió esa clase completa: cinco correctos. Total del conjunto actual: 194 casos distintos.
- Suite frontend completa: 636 casos, 635 correctos y un fallo de teclado al alternar Tutorial/Controles. Se reprodujo una carrera de eventos toggle pendientes; se corrigió con exclusión nativa de los details y se añadió regresión determinista. Reejecución de los archivos afectados y seguridad: 36/36 correctos, cero omisiones. Después se añadió el caso de sesión restaurada: seis pruebas de seguridad/navegación correctas. El conjunto actual contiene 638 casos distintos, verificados entre la ejecución completa y las repeticiones acotadas; no se presenta como una segunda corrida completa de 638 casos.
- Build frontend: correcto. Compilación/paquete backend: correcto. Smoke del build servido por preview: login, Administración y mapa de Simulación renderizados con cabeceras/CSP; inspección visual del lienzo Phaser sin bloqueo de assets.
- Lint: el proyecto no tiene un comando de lint configurado; no se presenta como una comprobación ejecutada.
- Regresión de diez niveles: se incluyen los cambios pendientes que impiden marcar geografía o máximo de estaciones como cumplidos en una red vacía. Los 20 casos (diez niveles × dos roles) verifican inicio vacío, reanudación propia, repetición y campaña nueva. Las consignas/JSON de reglas no se modifican.
- Las pruebas antes omitidas por falta de PostgreSQL se ejecutan mediante `bash backend/scripts/probar-postgres.sh`; crean y eliminan su propio clúster. No se omiten silenciosamente para declarar éxito.
- Pruebas de UI utilizan Chrome y API controlada; SeguridadPostgresTest utiliza Controllers, Services y PostgreSQL reales con correo simulado. El arranque/health adicional comprueba integración real del proceso local. No se afirma haber validado entrega SMTP a un buzón real ni un despliegue HTTPS externo.

Escaneo final de 433 archivos de texto versionables: sin candidatos a claves privadas/tokens conocidos; configuración privada y dump comprobados como ignorados.

No hubo eliminación de datos reales de usuarios por esta auditoría. La copia de recuperación y las credenciales quedan fuera del commit. El listado de archivos se conserva en los commits; el informe no modifica el Documento METRONET.


## Archivos afectados

- Backend: `AuthService`, `RecuperacionContrasenaService`, `UsuarioService`, `ValidadorDatos`; nuevos `LimiteSolicitudes`, `PoliticaContrasena`, `ConfiguracionCors`, `ProteccionHttp`; Controllers existentes para retirar CORS duplicado; `application.properties`, `.env.example`, `pom.xml`.
- Operación: `.gitignore`, `backend/scripts/iniciar-local.sh`, `iniciar-con-gmail.sh`, `probar-recuperacion.py`, `probar-postgres.sh`. HBA es configuración local externa al repositorio y no se publica.
- Frontend: `administracion.js`, `login.js`, `BienvenidaAcceso.js`, `NavegacionAplicacion.js`, nuevo `DestinoSeguro.js`, `seguridad-http.cjs`, `vite.config.js`; `PanelTutorialInicial.js` y `PanelAyudaContextual.js` para la regresión de teclado.
- Pruebas: `AuthSeguridadTest`, `ProteccionHttpTest`, `SeguridadPostgresTest`, `seguridad-interfaz.test.cjs`, `tutorial-inicial.test.cjs`.
- Corrección previa de niveles incluida: `CondicionesGeograficasService`, `JuegoEducativoService`, `AyudaContextual.js`, `CampanaPostgresTest`, `JuegoEducativoServiceTest`, `RestriccionesGeograficasIntegrationTest` y pruebas de ayuda contextual.
- Informes: este archivo, inventario de endpoints, evidencia de dependencias y análisis de impacto 2FA en `docs/auditorias/`.

No se agregaron endpoints ni se cambiaron contratos de datos. Se incorporan respuestas 429/413 para abuso y límites; una sesión cuyo rol cambió se considera inválida (401). Documentación académica potencialmente afectada: seguridad de sesiones/validación, instalación/configuración y estrategia de pruebas/recuperación. Su actualización queda pendiente de autorización específica.
