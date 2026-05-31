# Base de Datos

## Herramientas de Trabajo

La administración y desarrollo de la Base de Datos se realiza utilizando PostgreSQL como sistema gestor de datos y DBeaver como herramienta de administración y consulta.

## Objetivo

Este documento describe el papel de la Base de Datos dentro de la arquitectura del proyecto METRONET.

---

# ¿Qué es la Base de Datos?

La Base de Datos es el componente encargado de almacenar toda la información utilizada por el sistema.

Su objetivo es garantizar la persistencia y disponibilidad de los datos necesarios para el funcionamiento de la aplicación.

---

# Tecnología Utilizada

* PostgreSQL

---

# Ubicación en la Arquitectura

```text
Usuario
   │
   ▼
Frontend (Phaser)
   │
   ▼
Backend (Spring Boot)
   │
   ▼
Base de Datos (PostgreSQL)
```

---

# Responsabilidades

La Base de Datos es responsable de:

* Almacenar información.
* Mantener relaciones entre entidades.
* Garantizar la integridad de los datos.
* Permitir consultas eficientes.
* Proporcionar persistencia de la información.

---

# Qué NO debe hacer

La Base de Datos NO debe:

* Implementar lógica de negocio.
* Gestionar interfaces gráficas.
* Comunicarse directamente con el Frontend.

Estas responsabilidades corresponden al Backend.

---

# Acceso a los Datos

Todo acceso a la Base de Datos debe realizarse exclusivamente a través del Backend.

```text
Frontend
   │
   ▼
Backend
   │
   ▼
PostgreSQL
```

No se permite la comunicación directa entre Frontend y PostgreSQL.

---

# Información que Almacenará

La Base de Datos almacenará información relacionada con:

* Líneas de metro.
* Estaciones.
* Conexiones.
* Trenes.
* Configuraciones operativas.
* Datos necesarios para la simulación.

La definición exacta de tablas y relaciones se documentará en:

```text
docs/base_de_datos/
```

---

# Estado Actual

Actualmente la Base de Datos se encuentra en etapa de diseño.

Las tablas, relaciones y diagramas serán documentados a medida que avance el desarrollo del proyecto.

---

# Beneficios de Utilizar PostgreSQL

* Código abierto.
* Alta confiabilidad.
* Escalabilidad.
* Integración nativa con Spring Boot.
* Amplio soporte de la comunidad.

---

# Regla General

Toda información permanente del sistema deberá almacenarse en PostgreSQL y ser gestionada por el Backend.
