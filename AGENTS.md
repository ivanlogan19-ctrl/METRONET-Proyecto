# AGENTS.md — METRONET

## Propósito

Este archivo define las instrucciones obligatorias para cualquier agente de desarrollo que trabaje sobre el repositorio METRONET.

METRONET es un Sistema de Modelado de Líneas de Metro desarrollado como Proyecto Integrador académico.

Todo cambio debe conservar la coherencia entre:

- requerimientos funcionales;
- arquitectura;
- modelo de datos;
- código fuente;
- pruebas;
- documentación.

## Fuentes de autoridad

Consultar, en este orden:

1. `AGENTS.md`
2. Documento principal de METRONET ubicado en `docs/`
3. Requerimientos y casos de uso correspondientes
4. Arquitectura documentada
5. Diseño físico de la base de datos
6. Código fuente actualmente implementado
7. Pruebas existentes

Si el repositorio utiliza una versión tecnológica superior a la indicada en el documento, conservar la versión actual siempre que sea compatible con la arquitectura definida.

## Stack tecnológico

### Backend

- Java 21
- Spring Boot 3.5.x
- Maven
- Spring Web
- Spring Data JPA
- Hibernate
- PostgreSQL
- Spring Security Crypto
- Spring Mail
- Lombok
- H2 para pruebas cuando corresponda

### Frontend

- JavaScript
- Phaser 4.x
- Vite 7.x
- HTML5
- CSS

El documento original menciona Phaser 3, pero el repositorio utiliza una versión superior.

Mantener Phaser 4 mientras siga siendo compatible con METRONET.

No migrar automáticamente a:

- React
- Angular
- Vue
- TypeScript
- otro motor gráfico

### Integración

La comunicación entre frontend y backend debe realizarse mediante:

- HTTP
- API REST
- JSON

## Arquitectura

METRONET utiliza arquitectura cliente-servidor y separación por capas.

Flujo esperado:

Frontend / Phaser
↓
Controller
↓
Service
↓
Repository
↓
PostgreSQL

### Presentación

Responsabilidades:

- interfaz gráfica;
- mapa;
- estaciones;
- líneas;
- conexiones;
- unidades de metro;
- simulación visual;
- navegación.

Tecnología principal:

- Phaser

### Control

Implementado mediante Spring Boot Controllers.

Responsabilidades:

- recibir solicitudes HTTP;
- validar datos básicos;
- delegar operaciones;
- devolver respuestas HTTP.

Los Controllers deben mantenerse simples.

### Negocio

Implementado mediante Spring Boot Services.

Responsabilidades:

- reglas de negocio;
- validaciones;
- gestión de usuarios;
- diseños;
- líneas;
- estaciones;
- conexiones;
- escenarios;
- simulaciones.

La lógica funcional debe residir preferentemente en esta capa.

### Persistencia

Implementada mediante Spring Data JPA.

Responsabilidades:

- consultas;
- inserciones;
- actualizaciones;
- eliminaciones.

Los Repository no deben contener lógica de negocio.

### Datos

Tecnología:

- PostgreSQL

Mantener:

- claves primarias;
- claves foráneas;
- integridad referencial;
- restricciones NOT NULL;
- restricciones UNIQUE.

## Patrones utilizados

METRONET utiliza principalmente:

- arquitectura multicapa;
- MVC;
- Facade cuando corresponda.

No incorporar sin autorización:

- microservicios;
- arquitectura distribuida;
- CQRS;
- Event Sourcing;
- Kubernetes;
- sistemas de mensajería;
- alta disponibilidad empresarial.

## Nomenclatura

### Clases

Usar PascalCase.

Ejemplos:

Usuario  
LineaMetro  
Estacion  
EscenarioSimulacion  

### Métodos y atributos

Usar camelCase.

Ejemplos:

crearProyecto()  
guardarDiseno()  
obtenerUsuario()  
cantidadEstaciones  
velocidadSimulacion  

### Constantes

Usar mayúsculas y guion bajo.

Ejemplos:

MAX_ESTACIONES  
TIEMPO_MAXIMO_SIMULACION  
VELOCIDAD_DEFECTO  

### Idioma

Utilizar español como idioma preferente para identificadores del dominio.

Se permite inglés cuando corresponda a:

- frameworks;
- APIs;
- bibliotecas;
- patrones;
- convenciones técnicas.

Ejemplos aceptados:

controller  
repository  
request  
response  
login  
logout  
UUID  

## Backend

Mantener separación de responsabilidades.

Ejemplo:

UsuarioController  
↓  
UsuarioService  
↓  
UsuarioRepository  

Los Controllers coordinan solicitudes.

Los Services implementan reglas.

Los Repository acceden a datos.

## Frontend

Separar cuando corresponda:

- escenas Phaser;
- estado;
- lógica de simulación;
- comunicación con backend;
- autenticación;
- navegación;
- utilidades.

Evitar concentrar toda la lógica dentro de `MapaScene`.

No colocar dentro de una Scene:

- persistencia;
- reglas de negocio;
- autenticación;
- toda la lógica de simulación;
- llamadas REST innecesarias.

## API REST

Utilizar endpoints REST coherentes.

Ejemplos:

GET /api/disenos  
GET /api/disenos/{id}  
POST /api/disenos  
PUT /api/disenos/{id}  
DELETE /api/disenos/{id}  

Utilizar JSON.

Usar códigos HTTP apropiados:

- 200 OK
- 201 Created
- 204 No Content
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 409 Conflict
- 500 Internal Server Error

## Modelo de datos

Entidades principales:

- Usuario
- Diseno
- Linea
- Estacion
- Metro
- Escenario
- Intento
- Simulacion
- Tramo

No modificar relaciones, claves o cardinalidades sin revisar:

- modelo relacional;
- entidades JPA;
- Services;
- endpoints;
- frontend;
- pruebas;
- documentación.

## Seguridad

Nunca almacenar contraseñas en texto plano.

No incluir en Git:

- contraseñas;
- tokens;
- API keys;
- credenciales SMTP;
- credenciales PostgreSQL reales.

Utilizar variables de entorno.

Conservar las variables con prefijo:

METRONET_

## JPA / Hibernate

Evitar:

- consultas N+1;
- cascadas no controladas;
- relaciones bidireccionales innecesarias;
- EAGER indiscriminado;
- eliminación accidental de datos.

Mantener:

spring.jpa.open-in-view=false

salvo decisión arquitectónica justificada.

## Testing

El proyecto contempla:

- pruebas unitarias;
- pruebas de integración;
- pruebas funcionales;
- pruebas de persistencia;
- pruebas de regresión;
- pruebas de aceptación.

Priorizar pruebas para:

- Services;
- validaciones;
- Controllers relevantes;
- persistencia;
- errores;
- permisos;
- contratos REST.

## TDD

Para reglas importantes se recomienda:

RED  
↓  
GREEN  
↓  
REFACTOR  

Especialmente para:

- validación de conexiones;
- estaciones;
- transbordos;
- simulación;
- autenticación;
- permisos;
- reglas de negocio.

## Desarrollo de funcionalidades

Antes de modificar código:

1. identificar el requerimiento o caso de uso;
2. localizar el código relacionado;
3. determinar las capas afectadas;
4. revisar el modelo de datos;
5. definir el comportamiento esperado;
6. revisar pruebas existentes.

Realizar el cambio mínimo necesario.

No hacer refactors generales durante una tarea pequeña.

## Corrección de errores

Ante un bug:

1. reproducir;
2. identificar comportamiento esperado;
3. identificar comportamiento actual;
4. encontrar causa raíz;
5. crear prueba de regresión cuando sea posible;
6. aplicar corrección mínima;
7. ejecutar nuevamente las pruebas.

No modificar código únicamente basándose en hipótesis.

## Git

Los cambios deben ser:

- pequeños;
- coherentes;
- trazables;
- descriptivos.

Ejemplos:

feat: agregar creación de estaciones  
fix: corregir validación de conexiones  
test: agregar pruebas de UsuarioService  
refactor: separar lógica de simulación  
docs: actualizar documentación  

## Dependencias

No agregar dependencias sin necesidad concreta.

No realizar actualizaciones masivas durante tareas funcionales.

## Cambios prohibidos por defecto

No realizar automáticamente:

- JavaScript → TypeScript;
- Phaser → otro motor;
- Spring Boot → otro framework;
- PostgreSQL → otro motor;
- MVC → otra arquitectura;
- monolito → microservicios;
- cambio del modelo relacional;
- renombrados masivos;
- refactors globales;
- Docker/Kubernetes sin autorización;
- eliminación de funcionalidades documentadas.

Estos cambios requieren autorización expresa.

## Documentación

METRONET es un Proyecto Integrador académico.

La documentación y el código deben mantenerse alineados.

Si un cambio afecta:

- comportamiento;
- arquitectura;
- base de datos;
- API;
- requerimientos;
- casos de uso;

indicar qué documentación debería actualizarse.

No modificar automáticamente el documento académico sin autorización.

## Definición de terminado

Una tarea no está terminada únicamente porque compile.

Comprobar, cuando corresponda:

- implementación;
- compilación;
- pruebas;
- integración frontend/backend;
- persistencia;
- códigos HTTP;
- validaciones;
- arquitectura;
- nomenclatura;
- documentación afectada.

No afirmar que algo fue probado si no fue realmente probado.

## Informe final

Al finalizar una tarea informar:

- qué se implementó o corrigió;
- requerimiento relacionado;
- archivos modificados;
- capas afectadas;
- pruebas ejecutadas;
- cambios de base de datos;
- endpoints modificados;
- documentación afectada;
- pendientes reales.

## Principio general

METRONET debe evolucionar de forma incremental.

Priorizar:

- cambios pequeños;
- responsabilidades claras;
- soluciones simples;
- pruebas reproducibles;
- trazabilidad;
- coherencia con el Proyecto Integrador.