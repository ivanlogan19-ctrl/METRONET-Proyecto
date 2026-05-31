# Backend

## Herramientas de Trabajo

El desarrollo del Backend se realiza principalmente utilizando IntelliJ IDEA Community Edition como entorno de desarrollo, Maven para la gestión del proyecto y Spring Boot como framework principal.

## Objetivo

Este documento describe la responsabilidad del Backend dentro del proyecto METRONET.

---

# ¿Qué es el Backend?

El Backend es el componente encargado de procesar la información y aplicar las reglas del sistema.

---

# Tecnologías Utilizadas

* Java
* Spring Boot

---

# Responsabilidades

El Backend es responsable de:

* Procesar solicitudes.
* Validar datos.
* Aplicar reglas de negocio.
* Gestionar operaciones sobre la base de datos.
* Exponer servicios REST.

---

# Qué NO debe hacer

El Backend NO debe:

* Dibujar elementos gráficos.
* Gestionar interfaces visuales.
* Controlar la presentación visual.

Estas responsabilidades pertenecen al Frontend.

---

# Ubicación en el Proyecto

```text
backend/
```

---

# Ejemplos de Tareas de Backend

* Crear APIs REST.
* Crear controladores.
* Crear servicios.
* Crear entidades.
* Gestionar consultas a PostgreSQL.

---

# Regla General

Toda la lógica del sistema debe implementarse en el Backend.
