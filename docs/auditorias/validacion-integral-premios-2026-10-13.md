# Validación integral, premios y rendimiento — 2026-10-13

## Alcance y estado

- **DEFINIDO:** se conserva la arquitectura cliente-servidor y PostgreSQL del Documento METRONET. Esta revisión no modifica requisitos, entidades ni contratos REST.
- **IMPLEMENTADO:** se verifican las reglas de campaña aprobadas por el usuario: diez niveles con cinco metas cada uno; niveles 1–5 sin POI obligatorios y 6–10 con tres POI cada uno, quince diferentes. Se comprueban construcción, guardado, simulación, finalización explícita, premios y tarjetas.
- **PROPUESTO:** no se incorporan funcionalidades nuevas ni cambios pendientes de aprobación.

## Cambios

| Archivo | Cambio |
| --- | --- |
| `frontend/src/mapa/capas/CapaDesplazamientos.js` | Calcula los 49 puntos de cada curva cuando cambia la hora o escala del mapa y los reutiliza durante la animación. La punta de cada flecha sigue avanzando. |
| `frontend/tests/desplazamientos-rendimiento.test.cjs` | Comprueba reutilización durante 60 cuadros, movimiento de flechas e invalidación al cambiar hora y escala. |
| `frontend/tests/medicion-rendimiento.test.cjs` | Comprueba que la regla visible no reescribe etiquetas ni estilos durante 30 actualizaciones con cámara y red inmóviles. |
| `frontend/tests/recorrido-integral-e2e.test.cjs` | Consulta tarjetas y trofeos antes/después de finalizar cada nivel mediante API real y verifica la presentación de cada premio nuevo. |
| `frontend/tests/soporte/pantallas.cjs` | Actualiza los tramos de prueba al contrato geográfico vigente (`distanciaKm`). |
| `frontend/tests/simulacion-organizacion.test.cjs` | Cierra explícitamente la oferta de tutorial antes de comprobar controles y cámara. |
| `frontend/tests/simulacion-viewport.test.cjs` | Actualiza distancias, oferta de tutorial y etiqueta accesible de UT. |

La animación evita reconstruir hasta 588 puntos por cuadro (12 flujos × 49), sin reducir la definición de las curvas. No se atribuye un aumento de FPS: se verificó la eliminación de trabajo repetido, no un benchmark de hardware.

Los fallos iniciales de las pruebas de presentación provenían de datos antiguos sin kilómetros y de una bienvenida modal sin cerrar. No se cambió la lógica productiva para aceptar esos datos incompletos. Durante la ampliación del recorrido de premios se corrigieron dos supuestos de la prueba: los premios aparecen después de elegir Jugar y el texto visual se transforma a mayúsculas por CSS.

## Verificación

Entorno: Java 21, PostgreSQL 17.10 temporal, Spring Boot con puerto aleatorio, Vite en `127.0.0.1:5198` y Chrome instalado. Las pruebas integrales redirigen las solicitudes al servidor de prueba sin sustituir sus respuestas REST. La entrega de correo es un colaborador simulado; no se envían correos.

| Comprobación | Resultado |
| --- | --- |
| Suite completa Maven con `METRONET_E2E_RECORRIDO=true METRONET_E2E_CALLES=true bash backend/scripts/probar-postgres.sh -DfailIfNoTests=true` | 339 pruebas, 0 fallos, 0 errores, 0 omitidas; salida 0. Incluye PostgreSQL y los dos recorridos de navegador. Ejecutada antes de la optimización exclusivamente frontend. |
| Modo Libre integral repetido después de optimizar las curvas (`CallesModoLibreE2EPostgresTest`) | 1 prueba Java y recorrido Chrome aprobados: capas, construcción, persistencia, regla, cámara, horarios, UV/UT, medianoche, pausa/reanudación, cobertura, tutoriales y permisos. |
| Campaña integral con las nuevas comprobaciones de premios | `METRONET_E2E_RECORRIDO=true bash backend/scripts/probar-postgres.sh -Dtest=RecorridoIntegralE2EPostgresTest -DfailIfNoTests=true`: salida 0; 1/1 prueba Java y 11/11 pruebas Chrome (campaña + diez niveles), sin omitidas. Diez niveles a 100 puntos; tarjetas bloqueadas antes de aprobar y siete nuevas por nivel; premios estacion en N1, camino en N5, corona/biblioteca/copa en N10, cada uno presentado una vez. Acceso final a Modo Libre aprobado. |
| `simulacion-organizacion.test.cjs` + `simulacion-viewport.test.cjs` | 25/25 aprobadas, salida 0; tamaños 320, 360, 390, 768 y 1440 según caso. |
| Regresiones de niveles, fluidez, carga/render, tutoriales, regla, desplazamientos, cancelación de premios, tarjetas, motor y reloj | 117/117 aprobadas, salida 0. Incluye los diez niveles en 1440×900, 1280×720 y 390×844 y actualización de metas al construir. |
| `npm --prefix frontend run build` | Salida 0. |
| `git diff --check` | Salida 0, después de los cambios. |
| Comparación del catálogo local con frontend y recurso empaquetado del backend | Coinciden los diez nombres y reglas. Cinco metas por nivel y quince POI únicos. Un Modo Libre. |
| Publicaciones actuales de PostgreSQL local | Siete tarjetas por nivel, setenta en total. Las diez publicaciones vigentes coinciden exactamente con las reglas del catálogo local. |

Comando de regresiones (variables `METRONET_PLAYWRIGHT_PATH`, `METRONET_BROWSER_CHANNEL=chrome` y `METRONET_URL_PRUEBAS=http://127.0.0.1:5198`):

```sh
node --test --test-concurrency=1 \
  frontend/tests/niveles-cinco-metas.test.cjs \
  frontend/tests/fluidez-campana.test.cjs \
  frontend/tests/rendimiento-carga.test.cjs \
  frontend/tests/rendimiento-render.test.cjs \
  frontend/tests/tutorial-simulacion.test.cjs \
  frontend/tests/tutorial-recorrido-integral.test.cjs \
  frontend/tests/medicion-rendimiento.test.cjs \
  frontend/tests/desplazamientos-rendimiento.test.cjs \
  frontend/tests/cancelacion-celebracion.test.cjs \
  frontend/tests/tarjetas-rotacion-70.test.cjs \
  frontend/tests/motor-velocidad.test.cjs \
  frontend/tests/reloj-territorial.test.mjs \
  frontend/tests/desplazamientos.test.mjs
```

## Datos y limpieza

La base personal se consultó en modo lectura. Resultado: cero usuarios con dominios de pruebas `example.test`/`example.invalid`, cero intentos huérfanos y cero diseños sin referencia desde intentos o escenarios. No hubo registros identificados que borrar. No se eliminaron partidas ni publicaciones históricas necesarias para conservar resultados y tarjetas. Los clústeres PostgreSQL temporales y sus datos se eliminan automáticamente al terminar cada ejecución, incluso ante fallo.

No hay migraciones, modificaciones de esquema ni endpoints nuevos. Los catálogos históricos todavía utilizados por inicialización, administración o compatibilidad no se eliminan por su antigüedad.

## Límites

- La cobertura integral acredita los recorridos ejecutados, no todas las redes posibles ni cada combinación de acciones.
- Las 142 comprobaciones de presentación/regresión usan API interceptada cuando el caso es de componentes; se complementan con los recorridos reales, no los sustituyen. No se ejecutó cada archivo histórico de pruebas frontend.
- No se probaron Safari, Firefox, teléfonos físicos ni carga de muchos usuarios concurrentes.
- No se verificó entrega SMTP real ni el transcurso efectivo de un mes del actualizador de tráfico.
- Se mantiene el significado físico vigente: distancias geográficas del trazado entre estaciones; no son distancias por calles ni una simulación de pasajeros.

Este archivo registra evidencia técnica y no modifica el Documento METRONET académico.
