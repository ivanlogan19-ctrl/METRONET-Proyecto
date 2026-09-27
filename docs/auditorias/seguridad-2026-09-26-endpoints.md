# Inventario de endpoints — estado implementado

Generado a partir de los Controllers y contrastado con AuthService/Services. Los controles de UI no se consideran autorización. La consulta de consigna admite ADMIN además del propietario; las operaciones administrativas usan sus rutas explícitas.

| Método | Ruta | Control | Fuente |
|---|---|---|---|
| GET | `/api/admin/actividades` | ADMIN (AuthService) | `ActividadAdministrativaController.java:26` |
| POST | `/auth/login` | Público; validación de credenciales/código cuando corresponde | `AuthController.java:32` |
| POST | `/auth/registro` | Público; validación de credenciales/código cuando corresponde | `AuthController.java:37` |
| POST | `/auth/login/admin` | Público; validación de credenciales/código cuando corresponde | `AuthController.java:42` |
| POST | `/auth/logout/admin` | Invalida únicamente el Bearer recibido | `AuthController.java:49` |
| GET | `/auth/perfil` | Sesión propia | `AuthController.java:57` |
| PATCH | `/auth/perfil/datos-personales` | Sesión propia | `AuthController.java:64` |
| PATCH | `/auth/perfil/correo` | Sesión propia | `AuthController.java:72` |
| PATCH | `/auth/perfil/contrasena` | Sesión propia | `AuthController.java:80` |
| POST | `/auth/logout` | Invalida únicamente el Bearer recibido | `AuthController.java:89` |
| GET | `/api/configuraciones` | Sesión propia | `ConfiguracionConsultaController.java:23` |
| GET | `/api/admin/configuracion` | ADMIN (AuthService) | `ConfiguracionController.java:35` |
| PATCH | `/api/admin/configuracion/{clave}` | ADMIN (AuthService) | `ConfiguracionController.java:41` |
| GET | `/api/admin/disenos` | ADMIN (AuthService) | `DisenoAdministracionController.java:46` |
| GET | `/api/admin/disenos/{idDiseno}` | ADMIN (AuthService) | `DisenoAdministracionController.java:52` |
| DELETE | `/api/admin/disenos/{idDiseno}` | ADMIN (AuthService) | `DisenoAdministracionController.java:58` |
| POST | `/api/admin/disenos/{idDiseno}/lineas` | ADMIN (AuthService) | `DisenoAdministracionController.java:65` |
| PATCH | `/api/admin/disenos/{idDiseno}/lineas/{nombreLinea}` | ADMIN (AuthService) | `DisenoAdministracionController.java:71` |
| DELETE | `/api/admin/disenos/{idDiseno}/lineas/{nombreLinea}` | ADMIN (AuthService) | `DisenoAdministracionController.java:77` |
| POST | `/api/admin/disenos/{idDiseno}/estaciones` | ADMIN (AuthService) | `DisenoAdministracionController.java:83` |
| PATCH | `/api/admin/disenos/{idDiseno}/estaciones/{nombreEstacion}` | ADMIN (AuthService) | `DisenoAdministracionController.java:89` |
| DELETE | `/api/admin/disenos/{idDiseno}/estaciones/{nombreEstacion}` | ADMIN (AuthService) | `DisenoAdministracionController.java:95` |
| POST | `/api/admin/disenos/{idDiseno}/conexiones` | ADMIN (AuthService) | `DisenoAdministracionController.java:101` |
| PATCH | `/api/admin/disenos/{idDiseno}/conexiones` | ADMIN (AuthService) | `DisenoAdministracionController.java:107` |
| DELETE | `/api/admin/disenos/{idDiseno}/conexiones` | ADMIN (AuthService) | `DisenoAdministracionController.java:113` |
| POST | `/api/admin/disenos/{idDiseno}/tramos` | ADMIN (AuthService) | `DisenoAdministracionController.java:119` |
| PATCH | `/api/admin/disenos/{idDiseno}/tramos` | ADMIN (AuthService) | `DisenoAdministracionController.java:125` |
| DELETE | `/api/admin/disenos/{idDiseno}/tramos` | ADMIN (AuthService) | `DisenoAdministracionController.java:131` |
| POST | `/api/admin/disenos/{idDiseno}/unidades` | ADMIN (AuthService) | `DisenoAdministracionController.java:137` |
| PATCH | `/api/admin/disenos/{idDiseno}/unidades/{idTren}` | ADMIN (AuthService) | `DisenoAdministracionController.java:143` |
| DELETE | `/api/admin/disenos/{idDiseno}/unidades/{idTren}` | ADMIN (AuthService) | `DisenoAdministracionController.java:149` |
| GET | `/api/health` | Público; validación de credenciales/código cuando corresponde | `HealthController.java:18` |
| GET | `/api/juego/escenarios` | Sesión propia | `JuegoEducativoController.java:42` |
| GET | `/api/juego/progreso` | Sesión propia | `JuegoEducativoController.java:47` |
| POST | `/api/juego/escenarios/{idEscenario}/iniciar` | Sesión propia | `JuegoEducativoController.java:52` |
| POST | `/api/juego/escenarios/{idEscenario}/volver-a-jugar` | Sesión propia | `JuegoEducativoController.java:60` |
| POST | `/api/juego/recorrido/reiniciar` | Sesión propia | `JuegoEducativoController.java:68` |
| POST | `/api/juego/disenos/{idDiseno}/evaluar` | Sesión + propietario (Services) | `JuegoEducativoController.java:77` |
| GET | `/api/juego/disenos/{idDiseno}/consigna` | Sesión + propietario (Services) | `JuegoEducativoController.java:85` |
| GET | `/api/juego/disenos/{idDiseno}/desempeno` | Sesión + propietario (Services) | `JuegoEducativoController.java:93` |
| GET | `/api/juego/ranking` | Sesión propia | `JuegoEducativoController.java:98` |
| PATCH | `/auth/recuperar-contrasena` | Público; validación de credenciales/código cuando corresponde | `RecuperacionContrasenaController.java:24` |
| POST | `/auth/recuperar-contrasena/reenviar-codigo` | Público; validación de credenciales/código cuando corresponde | `RecuperacionContrasenaController.java:30` |
| POST | `/auth/recuperar-contrasena/verificar-codigo` | Público; validación de credenciales/código cuando corresponde | `RecuperacionContrasenaController.java:36` |
| PATCH | `/auth/recuperar-contrasena/cambiar-contrasena` | Público; validación de credenciales/código cuando corresponde | `RecuperacionContrasenaController.java:41` |
| GET | `/api/simulaciones` | Sesión + propietario (Services) | `SimulacionController.java:47` |
| POST | `/api/simulaciones` | Sesión + propietario (Services) | `SimulacionController.java:54` |
| GET | `/api/simulaciones/{idDiseno}` | Sesión + propietario (Services) | `SimulacionController.java:63` |
| POST | `/api/simulaciones/{idDiseno}/estaciones` | Sesión + propietario (Services) | `SimulacionController.java:71` |
| POST | `/api/simulaciones/{idDiseno}/lineas` | Sesión + propietario (Services) | `SimulacionController.java:80` |
| POST | `/api/simulaciones/{idDiseno}/escenarios` | Sesión + propietario (Services) | `SimulacionController.java:89` |
| POST | `/api/simulaciones/{idDiseno}/guardar` | Sesión + propietario (Services) | `SimulacionController.java:98` |
| POST | `/api/simulaciones/{idDiseno}/unidades` | Sesión + propietario (Services) | `SimulacionController.java:106` |
| DELETE | `/api/simulaciones/{idDiseno}/unidades/{idTren}` | Sesión + propietario (Services) | `SimulacionController.java:115` |
| PATCH | `/api/simulaciones/{idDiseno}/unidades/{idTren}` | Sesión + propietario (Services) | `SimulacionController.java:124` |
| PATCH | `/api/simulaciones/{idDiseno}/escenario` | Sesión + propietario (Services) | `SimulacionController.java:134` |
| DELETE | `/api/simulaciones/{idDiseno}` | Sesión + propietario (Services) | `SimulacionController.java:143` |
| POST | `/api/simulaciones/{idDiseno}/ejecutar` | Sesión + propietario (Services) | `SimulacionController.java:151` |
| GET | `/api/simulaciones/{idDiseno}/resultados` | Sesión + propietario (Services) | `SimulacionController.java:160` |
| PATCH | `/api/simulaciones/{idDiseno}/estaciones/{nombreEstacion}` | Sesión + propietario (Services) | `SimulacionController.java:168` |
| DELETE | `/api/simulaciones/{idDiseno}/estaciones/{nombreEstacion}` | Sesión + propietario (Services) | `SimulacionController.java:178` |
| PATCH | `/api/simulaciones/{idDiseno}/lineas/{nombreLinea}` | Sesión + propietario (Services) | `SimulacionController.java:187` |
| DELETE | `/api/simulaciones/{idDiseno}/lineas/{nombreLinea}` | Sesión + propietario (Services) | `SimulacionController.java:197` |
| POST | `/api/simulaciones/{idDiseno}/tramos` | Sesión + propietario (Services) | `SimulacionController.java:206` |
| PATCH | `/api/simulaciones/{idDiseno}/tramos` | Sesión + propietario (Services) | `SimulacionController.java:215` |
| DELETE | `/api/simulaciones/{idDiseno}/tramos` | Sesión + propietario (Services) | `SimulacionController.java:229` |
| GET | `/api/simulaciones/{idDiseno}/validacion` | Sesión + propietario (Services) | `SimulacionController.java:240` |
| POST | `/api/simulaciones/{idDiseno}/validacion` | Sesión + propietario (Services) | `SimulacionController.java:248` |
| GET | `/api/admin/usuarios` | ADMIN (AuthService) | `UsuarioController.java:38` |
| PATCH | `/api/admin/usuarios/{idUsuario}/rol` | ADMIN (AuthService) | `UsuarioController.java:46` |
| PATCH | `/api/admin/usuarios/{idUsuario}` | ADMIN (AuthService) | `UsuarioController.java:63` |
| DELETE | `/api/admin/usuarios/{idUsuario}` | ADMIN (AuthService) | `UsuarioController.java:75` |
