# Subir Cambios al Repositorio

## Objetivo

Este documento describe el procedimiento para guardar y subir cambios al repositorio utilizando Git.

---

# Paso 1 - Verificar Rama Actual

Antes de comenzar cualquier tarea verificar la rama activa.

```bash
git branch
```

Resultado esperado:

```text
* desarrollo-juan
```

o

```text
* desarrollo-viviana
```

o

```text
* desarrollo-logan
```

---

# Paso 2 - Verificar Cambios

```bash
git status
```

---

# Paso 3 - Agregar Cambios

```bash
git add .
```

---

# Paso 4 - Crear Commit

```bash
git commit -m "Descripción breve del cambio realizado"
```

Ejemplos:

```bash
git commit -m "Agregar entidad Estacion"

git commit -m "Corregir validacion de Linea"

git commit -m "Actualizar documentacion de PostgreSQL"
```

---

# Paso 5 - Subir Cambios

Juan:

```bash
git push origin desarrollo-juan
```

Viviana:

```bash
git push origin desarrollo-viviana
```

Logan:

```bash
git push origin desarrollo-logan
```

---

# Importante

Nunca realizar push directamente sobre:

```text
main
integracion-equipo
```

Estas ramas son administradas únicamente por Logan Iglesias.
