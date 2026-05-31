# Cómo Verificar las Instalaciones

## Objetivo

Este documento permite comprobar que todas las herramientas necesarias para trabajar en METRONET se encuentran correctamente instaladas y configuradas.

Si alguna verificación falla, revisar el documento:

como_instalar.md

---

# Abrir una Terminal

## Windows

Abrir:

* PowerShell
  o
* Git Bash

## macOS

Abrir:

* Terminal

---

# Verificar Git

Ejecutar:

```bash
git --version
```

Resultado esperado:

```text
git version X.X.X
```

Si aparece un número de versión, Git está correctamente instalado.

---

# Verificar Visual Studio Code

Ejecutar:

```bash
code --version
```

Resultado esperado:

```text
1.xx.x
```

También puede verificarse abriendo Visual Studio Code normalmente.

---

# Verificar Java

Ejecutar:

```bash
java -version
```

Resultado esperado:

```text
openjdk version "17"
```

o una versión superior.

---

# Verificar Maven

Ejecutar:

```bash
mvn -version
```

Resultado esperado:

```text
Apache Maven X.X.X
```

---

# Verificar PostgreSQL

Ejecutar:

```bash
psql --version
```

Resultado esperado:

```text
psql (PostgreSQL) X.X
```

---

# Verificar Conexión a PostgreSQL

Ingresar:

```bash
psql postgres
```

Resultado esperado:

```text
postgres=#
```

Salir utilizando:

```sql
\q
```

---

# Verificar DBeaver

Abrir DBeaver.

Verificar que:

* Inicie correctamente.
* Permita crear conexiones.
* Detecte PostgreSQL.

---

# Verificar Node.js

Ejecutar:

```bash
node -v
```

Resultado esperado:

```text
vXX.X.X
```

---

# Verificar npm

Ejecutar:

```bash
npm -v
```

Resultado esperado:

```text
XX.X.X
```

---

# Verificación Final

Todas las verificaciones anteriores deben completarse correctamente antes de continuar.

Si alguna herramienta no responde o genera errores:

1. Revisar el documento como_instalar.md.
2. Reinstalar la herramienta correspondiente.
3. Solicitar asistencia al administrador del proyecto.

---

# Siguiente Paso

Una vez verificadas todas las herramientas, continuar con:

como_ejecutar_el_proyecto.md

```
```
