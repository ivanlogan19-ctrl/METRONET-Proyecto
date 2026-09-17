# Recuperación de contraseña

METRONET recupera contraseñas mediante un código de seis dígitos enviado por correo. El código se guarda únicamente como hash BCrypt, vence a los diez minutos, admite hasta cinco intentos incorrectos y el reenvío se limita a una solicitud cada sesenta segundos.

Después de verificar el código, el backend entrega una autorización temporal de diez minutos. La contraseña nueva se guarda con BCrypt y se invalidan las sesiones activas de esa cuenta.

## Base de datos

En una instalación nueva, `database/002_creacion_tablas.sql` y `database/009_recuperacion_contrasena.sql` ya contienen la estructura completa.

En una base existente, ejecutar una vez `database/015_recuperacion_contrasena_por_codigo.sql` antes de iniciar el backend actualizado. La migración amplía la tabla existente y no elimina usuarios ni solicitudes.

## Correo SMTP

El correo permanece desactivado por defecto. Para habilitarlo, definir estas variables de entorno fuera del repositorio:

```text
METRONET_SMTP_HABILITADO=true
METRONET_SMTP_HOST=
METRONET_SMTP_PUERTO=587
METRONET_SMTP_USUARIO=
METRONET_SMTP_CONTRASENA=
METRONET_SMTP_REMITENTE=
METRONET_SMTP_AUTENTICACION=true
METRONET_SMTP_STARTTLS=true
```

No incluir credenciales SMTP, códigos, tokens ni contraseñas en archivos versionados o registros de la aplicación. Si SMTP no está configurado, la recuperación responde que no se encuentra disponible y no expone ningún código.
