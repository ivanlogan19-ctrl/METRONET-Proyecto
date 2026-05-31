# Cómo Ejecutar el Proyecto

## Objetivo

Este documento explica paso a paso cómo descargar, abrir y ejecutar el proyecto METRONET por primera vez.

Antes de continuar, verificar que todas las herramientas indicadas en los documentos:

* que_instalar.md
* como_instalar.md
* como_verificar.md

se encuentren correctamente instaladas y funcionando.

---

# Paso 1 - Clonar el Repositorio

El repositorio contiene todo el código fuente, documentación y archivos necesarios para el proyecto.

## Windows

Abrir:

* PowerShell
  o
* Git Bash

## macOS

Abrir:

* Terminal

Ejecutar:

```bash
git clone https://github.com/ivanlogan19-ctrl/METRONET-Proyecto.git
```

Una vez finalizada la descarga ingresar a la carpeta del proyecto:

```bash
cd METRONET-Proyecto
```

---

# Paso 2 - Verificar la Estructura del Proyecto

La carpeta principal debe contener una estructura similar a la siguiente:

```text
METRONET-Proyecto
│
├── backend
├── frontend
├── database
├── docs
└── README.md
```

Si alguna de estas carpetas no existe, verificar que el repositorio se haya descargado correctamente.

---

# Paso 3 - Abrir el Proyecto

## Visual Studio Code

Ubicarse dentro de la carpeta del proyecto y ejecutar:

```bash
code .
```

También es posible abrir Visual Studio Code manualmente y seleccionar la carpeta:

```text
METRONET-Proyecto
```

---

# Paso 4 - Verificar la Base de Datos

Abrir PostgreSQL o DBeaver.

Verificar que exista la base de datos:

```text
metronet
```

Si la base de datos no existe, consultar la documentación correspondiente dentro de:

```text
docs/base_de_datos/
```

---

# Paso 5 - Ejecutar el Backend

Abrir una terminal.

Ingresar a la carpeta:

```bash
cd backend
```

Ejecutar:

```bash
mvn spring-boot:run
```

Si el backend inicia correctamente deberían visualizarse mensajes similares a:

```text
Tomcat started on port 8080
Started BackendApplication
```

Mantener esta terminal abierta mientras se trabaja en el proyecto.

---

# Paso 6 - Ejecutar el Frontend

Abrir una segunda terminal.

Ingresar a la carpeta:

```bash
cd frontend
```

Instalar dependencias del proyecto:

```bash
npm install
```

Ejecutar el frontend:

```bash
npm start
```

Mantener esta terminal abierta mientras se trabaja en el proyecto.

---

# Paso 7 - Verificación Final

El entorno estará correctamente configurado cuando:

* El repositorio haya sido clonado correctamente.
* PostgreSQL se encuentre funcionando.
* La base de datos metronet exista.
* El backend se ejecute sin errores.
* El frontend se ejecute sin errores.
* Visual Studio Code pueda abrir el proyecto completo.

---

# Problemas Frecuentes

## Error: git no reconocido

Verificar la instalación de Git.

Consultar:

```text
configuracion_inicial/como_verificar.md
```

---

## Error: java no reconocido

Verificar la instalación de Java.

Consultar:

```text
configuracion_inicial/como_verificar.md
```

---

## Error: mvn no reconocido

Verificar la instalación de Maven.

Consultar:

```text
configuracion_inicial/como_verificar.md
```

---

## Error: psql no reconocido

Verificar la instalación de PostgreSQL.

Consultar:

```text
configuracion_inicial/como_verificar.md
```

---

## Error: node no reconocido

Verificar la instalación de Node.js.

Consultar:

```text
configuracion_inicial/como_verificar.md
```

---

# Responsable

Administrador del Proyecto: Logan Iglesias

---

# Última Actualización

31/05/2026

