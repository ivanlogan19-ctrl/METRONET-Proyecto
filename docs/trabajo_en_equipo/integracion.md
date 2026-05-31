# Integración de Cambios

## Objetivo

Este documento describe cómo se integran los desarrollos realizados por cada integrante del equipo.

---

# Flujo de Trabajo

```text
desarrollo-juan
        │
        ▼
desarrollo-logan
        │
        ▼
integracion-equipo
        │
        ▼
main
```

---

# Desarrollo Individual

Cada integrante desarrolla nuevas funcionalidades en su propia rama.

```text
Juan      → desarrollo-juan
Viviana   → desarrollo-viviana
Logan     → desarrollo-logan
```

---

# Revisión

Una vez finalizada una tarea:

1. El desarrollador realiza commit.
2. El desarrollador realiza push.
3. Logan revisa los cambios.
4. Logan decide si los integra.

---

# Integración

Solo Logan puede:

* Integrar cambios en integracion-equipo.
* Resolver conflictos.
* Integrar cambios en main.

---

# Objetivo de la Integración

Garantizar que:

* El proyecto compile correctamente.
* No existan conflictos.
* El código mantenga una estructura consistente.
* La documentación permanezca actualizada.
