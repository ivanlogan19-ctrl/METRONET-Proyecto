---
name: metronet-development
description: Use when an agent is asked to implement, modify, debug, test, review, refactor, or document software in the METRONET project.
---

# METRONET Development

## Objetivo

Esta Skill guía cualquier trabajo de desarrollo sobre METRONET utilizando las reglas oficiales del proyecto.

Las reglas permanentes están definidas en `AGENTS.md`. La documentación oficial de METRONET y el código existente proporcionan el detalle funcional y técnico.

## Antes de modificar código

1. Leer el `AGENTS.md` del repositorio.
2. Consultar la documentación relevante de METRONET.
3. Revisar la estructura, configuración, pruebas y código existente.
4. No inventar comportamiento cuando la documentación sea insuficiente o contradictoria.

## Trazabilidad

Antes de implementar un cambio, identificar:

`solicitud/requisito → caso de uso o dominio → capas afectadas → implementación → pruebas → evidencia → documentación`

Mantener los cambios acotados al alcance solicitado.

## Arquitectura de METRONET

Respetar la arquitectura definida:

- Frontend: Phaser 3, HTML5 y JavaScript.
- Comunicación: HTTP, API REST y JSON.
- Backend: Java con Spring Boot.
- Control: Controllers.
- Negocio: Services.
- Persistencia: Spring Data JPA / Hibernate.
- Base de datos: PostgreSQL.
- Build backend: Maven.
- Control de versiones: Git y GitHub.

No reemplazar esta arquitectura sin aprobación explícita.

## Versiones

METRONET admite Java 17 o superior.

La prueba técnica del proyecto utiliza Java 21 y Spring Boot 3.5.

Si el repositorio utiliza versiones superiores compatibles con las indicadas en la documentación:

- mantener la versión configurada;
- no degradar únicamente para coincidir con una referencia histórica;
- validar compatibilidad antes de realizar actualizaciones.

## Límites de alcance

No introducir sin aprobación explícita:

- microservicios;
- sistemas distribuidos;
- balanceo de carga;
- alta disponibilidad empresarial;
- procesamiento masivo de datos;
- infraestructura innecesaria para el alcance académico.

## Base de datos

PostgreSQL es la base de datos vigente.

Antes de modificar el modelo de datos revisar:

- esquema;
- entidades JPA;
- repositorios;
- servicios;
- relaciones;
- restricciones;
- pruebas de persistencia.

Si aparecen inconsistencias de nomenclatura, como `PASA` y `TRAMO`, no elegir arbitrariamente. Verificar el código y la documentación y reportar la discrepancia.

## Testing

METRONET contempla:

- pruebas unitarias;
- pruebas de integración;
- pruebas funcionales;
- pruebas de persistencia;
- pruebas de regresión;
- pruebas de aceptación.

Herramientas principales:

- JUnit;
- Mockito;
- Maven;
- Postman;
- PostgreSQL;
- navegadores;
- GitHub.

Las pruebas con mocks o H2 no demuestran por sí solas persistencia real en PostgreSQL.

Las pruebas de backend no sustituyen una prueba completa frontend + backend + base de datos.

## Seguridad

- No almacenar contraseñas en texto plano.
- No guardar secretos, tokens o credenciales en el repositorio.
- Respetar roles y permisos.
- Mantener variables sensibles fuera del código fuente.
- No exponer información sensible en logs.

## Finalización de tareas

Antes de afirmar que una tarea está terminada:

- ejecutar las verificaciones relevantes;
- revisar regresiones;
- comprobar que la arquitectura sigue siendo coherente;
- informar pruebas ejecutadas y sus resultados;
- indicar cualquier validación pendiente;
- informar discrepancias entre código y documentación.

La evidencia debe preceder a la afirmación de éxito.

## Regla principal

**REQUIRED:** seguir `AGENTS.md` para arquitectura, versiones, seguridad, testing, trazabilidad y criterios de finalización.
