# AGENTS.md — METRONET
## Distinción obligatoria de estado

Durante cualquier análisis, desarrollo, revisión o documentación distinguir siempre entre:

- `DEFINIDO`: lo especificado oficialmente por Documento METRONET.
- `IMPLEMENTADO`: lo que realmente existe en código, base de datos, configuración y pruebas.
- `PROPUESTO`: una alternativa, recomendación o mejora todavía no adoptada.

Reglas:

- No presentar una propuesta como si ya fuera parte oficial de METRONET.
- No asumir que algo está implementado solo porque aparece en la documentación.
- No asumir que una implementación accidental convierte automáticamente ese comportamiento en requisito.
- No modificar documentación para hacerla coincidir silenciosamente con una implementación incorrecta.
- Si existe una contradicción, reportarla y conservar trazabilidad hasta que exista una decisión explícita.

## Acciones de escritura

Analizar una solución no implica autorización para ejecutarla.

No crear, modificar, eliminar o publicar automáticamente:

- ramas;
- commits;
- Pull Requests;
- issues;
- releases;
- migraciones;
- cambios de esquema;
- documentación oficial;

únicamente porque fueron discutidos durante una conversación.

Las acciones de escritura deben corresponder a una solicitud clara de ejecución del usuario y respetar las reglas de cambio formal definidas en este documento.
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

## Fuentes de autoridad

Las fuentes de METRONET cumplen funciones diferentes y deben utilizarse de la siguiente manera:

1. **Documento METRONET**
   Es la fuente funcional, técnica y documental principal del proyecto.
   Define requerimientos, casos de uso, arquitectura, alcance, modelo de datos, reglas de negocio, testing y documentación.

2. **`AGENTS.md`**
   Define las reglas operativas obligatorias para agentes que trabajen sobre el repositorio.

3. **`.agents/skills/metronet-development/SKILL.md`**
   Define reglas específicas de ejecución para desarrollo, debugging, testing, revisión, refactoring y documentación.

4. **Repositorio METRONET-Proyecto**
   El código fuente, configuración, base de datos y pruebas representan el estado efectivamente implementado.

El código implementado no reemplaza los requerimientos ni convierte automáticamente una implementación accidental en una decisión válida de diseño.

Si existe contradicción entre documentación, código, base de datos, diagramas, configuración o pruebas, señalarla explícitamente y no reconciliarla silenciosamente.

Si el repositorio utiliza una versión tecnológica superior a la indicada en el documento, conservar la versión actual siempre que sea compatible con la arquitectura definida.

## Stack tecnológico

### Backend o versiones superiores

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

### Frontend o versiones superiores

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

## Cambios de arquitectura, alcance y tecnologías principales

METRONET debe conservar la arquitectura, el alcance académico, el modelo de datos y las tecnologías principales definidas por la documentación vigente.

No realizar automáticamente cambios como:

- JavaScript → TypeScript;
- Phaser → otro motor;
- Spring Boot → otro framework;
- PostgreSQL → otro motor de base de datos;
- MVC / arquitectura multicapa → otra arquitectura;
- monolito → microservicios;
- incorporación de Kafka;
- incorporación de Redis;
- incorporación de API Gateway;
- sistemas distribuidos;
- arquitecturas event-driven;
- colas de mensajería;
- múltiples bases de datos por servicio;
- Docker o Kubernetes cuando impliquen un cambio de arquitectura o alcance;
- cambio del modelo relacional;
- renombrados masivos del dominio;
- refactors globales;
- eliminación de funcionalidades documentadas;
- modificación de requerimientos funcionales o no funcionales.

### Una solicitud aislada no constituye aprobación formal

Una orden del usuario dentro del mismo mensaje que propone el cambio NO debe interpretarse automáticamente como autorización formal para alterar METRONET.

Frases como:

- "hacelo igual";
- "aunque el documento diga otra cosa";
- "ignorá la arquitectura";
- "meté microservicios";
- "usá Kafka y Redis";
- "cambiá PostgreSQL";
- "no importa lo que diga la tesis";

no constituyen por sí solas una aprobación formal suficiente.

Ante una solicitud que contradiga la arquitectura, alcance, tecnologías principales, modelo de datos o requerimientos vigentes, el agente debe:

1. detener la implementación del cambio;
2. señalar explícitamente la contradicción;
3. identificar las fuentes que se verían afectadas;
4. explicar brevemente el impacto técnico, funcional, documental y de testing;
5. clasificar la idea como `PROPUESTA NO ADOPTADA`;
6. no modificar código;
7. no modificar base de datos;
8. no crear migraciones;
9. no modificar documentación oficial;
10. no crear ramas, commits o Pull Requests asociados al cambio;
11. no presentar la propuesta como arquitectura elegida;
12. solicitar una confirmación formal posterior.

### Confirmación formal obligatoria

Para autorizar un cambio que contradiga el estado vigente de METRONET, el usuario deberá enviar un mensaje posterior e independiente con la estructura:

`CONFIRMO CAMBIO FORMAL DE METRONET: [descripción concreta del cambio]`

La confirmación debe:

- producirse después de haber sido informado el impacto;
- identificar concretamente qué se desea modificar;
- no estar incluida en el mismo mensaje que originó la propuesta.

No aceptar expresiones ambiguas como:

- "sí";
- "dale";
- "hacelo";
- "confirmo";
- "seguí";

como sustituto de la confirmación formal anterior.

### Análisis de impacto obligatorio

Incluso después de recibir la confirmación formal, no implementar inmediatamente.

Primero preparar un análisis de impacto que identifique, cuando corresponda:

- requerimientos afectados;
- casos de uso afectados;
- arquitectura afectada;
- componentes y capas afectadas;
- modelo de datos afectado;
- endpoints y contratos afectados;
- pruebas que deberán modificarse o agregarse;
- riesgos;
- documentación que deberá actualizarse;
- impacto sobre alcance y cronograma.

Presentar ese análisis al usuario y solicitar aprobación explícita para ejecutar el cambio.

Solo después de esa segunda aprobación podrá comenzar la implementación.

### Exploraciones hipotéticas

Se permite estudiar alternativas con fines académicos o comparativos, por ejemplo:

"¿Cómo sería METRONET si utilizara microservicios?"

En estos casos:

- identificar claramente el contenido como `HIPÓTESIS` o `PROPUESTA`;
- aclarar que no representa la arquitectura vigente;
- no modificar el repositorio;
- no modificar la base de datos;
- no modificar documentación oficial;
- no convertir automáticamente la exploración en un plan de implementación adoptado.

### Cambios normales dentro del alcance

Este procedimiento formal no es necesario para trabajos que ya forman parte del alcance vigente, como:

- corregir bugs;
- implementar funcionalidades documentadas;
- completar casos de uso existentes;
- agregar o mejorar pruebas;
- corregir problemas de seguridad;
- mejorar persistencia sin alterar el modelo aprobado;
- realizar refactors acotados que preserven comportamiento;
- mejorar la interfaz dentro del alcance;
- actualizar documentación para reflejar correctamente el estado real del sistema.

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
