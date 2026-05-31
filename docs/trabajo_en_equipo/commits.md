# Commits

## Objetivo

Este documento describe las buenas prácticas para registrar cambios en el proyecto mediante commits de Git.

---

# ¿Qué es un Commit?

Un commit es un registro de cambios realizados en el proyecto.

Permite mantener un historial ordenado del desarrollo y facilita la identificación de modificaciones realizadas por cada integrante.

---

# Buenas Prácticas

## Realizar commits pequeños

Es preferible realizar varios commits pequeños que un único commit muy grande.

Ejemplo:

```text
Agregar entidad Estacion
```

En lugar de:

```text
Cambios varios
```

---

## Utilizar mensajes descriptivos

El mensaje debe indicar claramente qué se modificó.

### Correcto

```text
Agregar entidad Linea

Corregir conexión a PostgreSQL

Actualizar documentación de instalación

Crear tabla Estacion
```

### Incorrecto

```text
Cambios

Update

Correcciones

Prueba
```

---

# Estructura Recomendada

Utilizar verbos en infinitivo:

```text
Agregar
Modificar
Actualizar
Corregir
Eliminar
Crear
Optimizar
```

Ejemplos:

```text
Agregar entidad Tren

Crear tabla Conexion

Actualizar documentación de Git

Corregir error de autenticación
```

---

# Cuándo Realizar un Commit

Realizar un commit cuando:

* Una tarea haya sido completada.
* Una funcionalidad funcione correctamente.
* Una corrección haya sido validada.
* Una sección de documentación haya sido finalizada.

Evitar commits con trabajo incompleto.

---

# Flujo de Trabajo

```bash
git add .

git commit -m "Descripción del cambio"

git push
```

---

# Importante

Todos los commits realizados en el proyecto deben ser claros, descriptivos y permitir identificar fácilmente el trabajo realizado por cada integrante.
