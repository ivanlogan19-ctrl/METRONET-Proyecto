# Comunicación Entre Componentes

## Objetivo

Este documento explica cómo interactúan los componentes principales de METRONET.

---

# Flujo General

```text
Usuario
   │
   ▼
Frontend
   │
   ▼
Backend
   │
   ▼
PostgreSQL
```

---

# Comunicación Frontend - Backend

El Frontend nunca se comunica directamente con la base de datos.

Toda comunicación debe realizarse mediante servicios REST expuestos por el Backend.

---

# Ejemplo

El usuario desea consultar las estaciones disponibles.

### Paso 1

El Frontend realiza una solicitud al Backend.

```text
GET /estaciones
```

### Paso 2

El Backend procesa la solicitud.

### Paso 3

El Backend consulta PostgreSQL.

### Paso 4

PostgreSQL devuelve los datos.

### Paso 5

El Backend devuelve la respuesta al Frontend.

### Paso 6

El Frontend muestra la información al usuario.

---

# Ventajas

* Mayor seguridad.
* Mejor mantenimiento.
* Separación de responsabilidades.
* Escalabilidad.

---

# Regla General

Todo acceso a la base de datos debe pasar por el Backend.
