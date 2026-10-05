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

---

## Contrato de evaluación de niveles (implementado en la copia en revisión)

`POST /api/juego/disenos/{idDiseno}/evaluar` devuelve `EvaluacionEscenarioResponse` una vez persistida la evaluación. Además de los campos previos (`completado`, `progreso`, `puntaje`, `mensaje`, `idSiguienteEscenario`, `modoLibreDesbloqueado` y `desempeno`), incluye:

```json
"trofeosNuevos": [
  {
    "id": "estacion",
    "nombre": "Primera estación",
    "requisito": "Completar el Nivel 1.",
    "motivo": "Completaste el primer nivel.",
    "obtenido": true
  }
]
```

El arreglo contiene únicamente los trofeos que pasaron de no obtenidos a obtenidos **en esa evaluación confirmada**. Es vacío si el nivel no se completó, si se reevalúa el mismo logro o si la cuenta es administrativa. Varios premios conservan el orden del catálogo. La comparación y la actualización del intento ocurren dentro de la misma transacción, serializadas por jugador.

El frontend muestra primero el resultado del nivel y después los premios nuevos, uno por uno, antes de iniciar el siguiente. Si falla una consulta posterior al resultado, la celebración pendiente no bloquea permanentemente el flujo. La cola vive en la respuesta actual: al cerrar o recargar la página no se reanuda. `GET /api/juego/trofeos` sigue siendo solo una consulta del catálogo y no desencadena celebraciones.

Este contrato no crea tabla, migración ni endpoint. El cierre de pestaña descarta los carteles pendientes, pero los premios obtenidos permanecen visibles en Ranking; esta semántica fue confirmada para el cambio actual.
