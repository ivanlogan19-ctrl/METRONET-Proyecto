Documentación de base de datos

Para recuperación de contraseña por código, las instalaciones existentes deben aplicar `015_recuperacion_contrasena_por_codigo.sql` antes de iniciar el backend actualizado. Consultar `docs/recuperacion-contrasena.md`.

Para reiniciar el recorrido educativo sin borrar el historial, las instalaciones existentes deben aplicar `016_reinicio_campana_escenarios.sql` después de la migración 015 y antes de iniciar el backend actualizado. La migración agrega únicamente columnas e índices: conserva intentos, diseños, simulaciones y puntajes ya registrados.
