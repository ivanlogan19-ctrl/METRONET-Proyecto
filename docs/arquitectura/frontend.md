# Frontend

## Herramientas de Trabajo

El desarrollo del Frontend se realiza principalmente utilizando Visual Studio Code como entorno de trabajo, Node.js para la gestión de dependencias y Phaser 3 para la construcción de la interfaz gráfica.
## Objetivo

Este documento describe la responsabilidad del Frontend dentro del proyecto METRONET.

---

# ¿Qué es el Frontend?

El Frontend es la parte visual del sistema con la que interactúa el usuario.

Su función es mostrar información y permitir la interacción con la simulación de la red de metro.

---

# Tecnología Utilizada

* Phaser 3
* JavaScript

---

# Responsabilidades

El Frontend es responsable de:

* Mostrar estaciones.
* Mostrar líneas de metro.
* Mostrar conexiones.
* Mostrar trenes.
* Capturar acciones del usuario.
* Presentar información visual.

---

# Qué NO debe hacer

El Frontend NO debe:

* Acceder directamente a PostgreSQL.
* Implementar lógica de negocio compleja.
* Tomar decisiones sobre los datos.

Estas responsabilidades pertenecen al Backend.

---

# Ubicación en el Proyecto

```text
frontend/
```

---

# Ejemplos de Tareas de Frontend

* Crear una nueva pantalla.
* Dibujar estaciones.
* Crear botones.
* Mostrar información de una línea.
* Representar el movimiento de un tren.

---

# Regla General

Todo aquello que el usuario vea o con lo que interactúe pertenece al Frontend.
