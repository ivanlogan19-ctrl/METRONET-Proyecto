# Configuración SMTP local de METRONET

METRONET permite enviar correos reales para la recuperación de contraseña mediante SMTP.

El backend obtiene la configuración desde variables de entorno:

- METRONET_SMTP_HABILITADO
- METRONET_SMTP_REMITENTE
- METRONET_SMTP_HOST
- METRONET_SMTP_PUERTO
- METRONET_SMTP_USUARIO
- METRONET_SMTP_CONTRASENA
- METRONET_SMTP_AUTENTICACION
- METRONET_SMTP_STARTTLS

## Configuración usada en desarrollo local

Para Gmail:

- METRONET_SMTP_HABILITADO=true
- METRONET_SMTP_HOST=smtp.gmail.com
- METRONET_SMTP_PUERTO=587
- METRONET_SMTP_AUTENTICACION=true
- METRONET_SMTP_STARTTLS=true

El correo remitente y usuario SMTP deben corresponder a la cuenta configurada.

La contraseña SMTP NO debe almacenarse en el repositorio. En macOS se recomienda guardar la contraseña de aplicación de Google en Keychain y cargarla mediante una variable de entorno local.

## Arranque del proyecto

npm --prefix ~/Developer/METRONET-Proyecto run dev

## Cierre del proyecto

npm --prefix ~/Developer/METRONET-Proyecto run stop

Las credenciales SMTP son configuración local y no forman parte del repositorio.
