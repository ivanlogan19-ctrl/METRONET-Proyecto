# Datos demostrativos

METRONET puede cargar dos cuentas y una red de demostración únicamente durante el inicio del backend y solo cuando se habilita de forma explícita. Por defecto no se crea ni modifica ningún dato demostrativo.

La carga prepara estas cuentas ficticias:

- `Usuario Prueba` con rol `JUGADOR`, el escenario libre `Red Demo - Usuario Prueba` con una red válida de tres estaciones, una línea, conexiones, una unidad de metro, un intento y una simulación completada. La simulación se valida y ejecuta mediante el motor real de METRONET. También queda marcado como completado el Nivel 1 mediante la evaluación educativa existente para que el Nivel 2 aparezca disponible.
- `Admin Prueba` con rol `ADMIN` e identificador `administrador.prueba`.

Las contraseñas nunca se guardan en el repositorio. El backend las recibe como variables de entorno, las valida y las almacena usando el codificador BCrypt configurado por la aplicación.

## Ejecutar localmente

Desde la carpeta `backend`, ejecutá:

```sh
./scripts/iniciar-con-datos-demostrativos.sh
```

El comando solicita ambas contraseñas sin mostrarlas en pantalla y luego inicia el backend. Cada contraseña debe tener al menos seis caracteres, una mayúscula y un carácter especial.

También se puede iniciar con variables de entorno:

```sh
METRONET_DATOS_DEMOSTRATIVOS_HABILITADOS=true \
METRONET_DATOS_DEMOSTRATIVOS_CONTRASENA_JUGADOR='una-clave-segura' \
METRONET_DATOS_DEMOSTRATIVOS_CONTRASENA_ADMINISTRADOR='otra-clave-segura' \
./mvnw spring-boot:run
```

Una vez creada la información, iniciá el backend normalmente sin esas variables. La semilla no se ejecutará de nuevo.

## Seguridad e idempotencia

- La propiedad `METRONET_DATOS_DEMOSTRATIVOS_HABILITADOS` permanece desactivada si no se define como `true`.
- Si falta una contraseña o no cumple la política de seguridad, el inicio se detiene sin crear datos parciales.
- Al ejecutarse otra vez con la opción habilitada, actualiza exclusivamente las dos cuentas y la red demostrativa identificadas por la semilla; no borra usuarios, escenarios de catálogo ni configuraciones existentes.
- No existe un endpoint público para ejecutar esta carga.
