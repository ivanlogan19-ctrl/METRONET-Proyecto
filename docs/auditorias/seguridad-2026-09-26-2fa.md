# ANÁLISIS DE IMPACTO 2FA

Estado: **PROPUESTA NO ADOPTADA**. No se implementó ni modificó esquema, entidad, endpoint o flujo de autenticación para 2FA. Requiere el proceso de confirmación formal y aprobación de ejecución de AGENTS.md.

## Alternativa recomendada para evaluar

TOTP con aplicación autenticadora, comenzando por cuentas ADMIN. Los códigos de recuperación serían aleatorios, de un solo uso y almacenados como hashes. No reutilizar el correo de recuperación como segundo factor predeterminado: comprometer un mismo buzón podría comprometer recuperación y factor. Esta recomendación debe contrastarse con accesibilidad y soporte disponibles antes de adoptarse.

Base técnica: [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238) para TOTP y [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html) para autenticadores y recuperación. La elección de alcance ADMIN es una propuesta para METRONET, no una exigencia atribuida a esas fuentes.

## Impacto previsto

| Área | Cambio propuesto, todavía no ejecutado |
|---|---|
| Requerimientos/casos de uso | Alta y verificación de segundo factor, ingreso en dos etapas, regeneración de códigos de rescate, pérdida de dispositivo, desactivación y auditoría. |
| Modelo | Persistencia vinculada a Usuario para factor habilitado, secreto TOTP cifrado, verificación de activación y último paso temporal aceptado; hashes/uso de códigos de rescate. Definir entidad/tabla o campos mediante revisión relacional, no añadirlos automáticamente. |
| Secretos | Clave de cifrado externa mediante METRONET_, rotación y respaldo. El secreto TOTP necesita recuperación para verificar, por lo que no basta un hash. |
| Login | Contraseña válida produce solo un desafío limitado y temporal, no una sesión autorizada. Emitir Bearer final después del segundo factor. Evitar que rutas ADMIN/JUGADOR o reanudación de bienvenida omitan el desafío. |
| API | Operaciones autenticadas de preparar/confirmar/deshabilitar factor y regenerar rescates; operación pública limitada para verificar desafío de login. Rutas y DTO deben definirse en el análisis de diseño aprobado. |
| Recuperación | Restablecer contraseña no deshabilita automáticamente 2FA. Diseñar recuperación sin dispositivo y prueba de identidad; no dejar un bypass mediante correo o ADMIN. |
| ADMIN | Reautenticación para cambiar factor propio; protección contra auto-bloqueo y proceso auditado de emergencia. No conceder al administrador acceso al secreto de otros usuarios. |
| UX | Explicación de enrolamiento, QR/secreto accesible una sola vez, confirmación de configuración, códigos de rescate descargables de forma segura, errores y reintentos comprensibles. Sin factor obligatorio hasta decisión explícita. |
| Pruebas | Código correcto/incorrecto/vencido/reutilizado, deriva horaria, intentos concurrentes, desafío ligado al usuario, bypass de endpoints, pérdida de dispositivo, rescate de un solo uso, restauración de BD y rotación de claves. |
| Documentación | Requerimientos, casos de uso, modelo relacional/JPA, contratos, seguridad, respaldo, manual de usuario y pruebas. Actualización solo con autorización. |

## Riesgos y decisión pendiente

- Bloqueo de usuarios por pérdida de dispositivo o de la clave de cifrado.
- Recuperación débil puede anular el beneficio del segundo factor.
- TOTP reduce el riesgo de contraseña robada, pero no evita phishing en tiempo real ni un XSS que robe una sesión ya autenticada.
- Requiere decidir alcance (ADMIN o todos), recuperación operativa, retención, respaldo de claves y soporte. No es solamente agregar una pantalla.
- Sin estimación cerrada de plazo hasta resolver esas decisiones; separar diseño de seguridad/modelo, implementación, pruebas negativas y actualización documental.

La arquitectura cliente-servidor por capas podría mantenerse, pero el modelo y los contratos sí cambiarían. Por ese motivo no se ejecutó como parte del hardening actual.
