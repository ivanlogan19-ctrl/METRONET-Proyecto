package com.metronet.backend.arquitectura;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/** Protege la separación de negocio y persistencia de los componentes revisados. */
class SeparacionCapasTest {
    private static final List<String> SERVICIOS = List.of(
        "ActividadAdministrativaService",
        "AdministracionNivelesService",
        "AdministracionUvUtService",
        "AprendizajeService",
        "CondicionesGeograficasService",
        "ConfiguracionService",
        "ContenidoPublicadoNivelService",
        "CriterioUvUtService",
        "DatosDemostrativosService",
        "DisenoAdministracionService",
        "DistanciasRedService",
        "ExtrasModoLibreService",
        "JuegoEducativoService",
        "PublicacionNivelService",
        "PuntuacionService",
        "RecorridoIntegralService",
        "RestriccionesGeograficasService",
        "SimulacionService",
        "TrofeosService",
        "UsuarioService",
        "ValidacionPublicacionNivelService",
        "VinculoUvUtLibre",
        "CatalogoEscenariosService"
    );
    private static final Path FUENTES = Path.of("src/main/java/com/metronet/backend");
    private static final Pattern SQL = Pattern.compile("\\b(SELECT|INSERT INTO|DELETE FROM|UPDATE \\w+ SET)\\b");

    @Test
    void serviciosDeleganAccesoADatos() throws Exception {
        for (String nombre : SERVICIOS) {
            String fuente = Files.readString(FUENTES.resolve("service/" + nombre + ".java"));
            assertFalse(fuente.contains("JdbcTemplate"), nombre);
            assertFalse(fuente.contains("DataSource"), nombre);
            assertFalse(SQL.matcher(fuente).find(), nombre + " no debe construir consultas SQL");
            assertTrue(fuente.contains("Repository"), nombre + " debe delegar persistencia");
        }
    }

    @Test
    void repositoriosNoDependenDeServicios() throws Exception {
        try (var archivos = Files.list(FUENTES.resolve("repository"))) {
            for (Path archivo : archivos.filter(ruta -> ruta.toString().endsWith(".java")).toList()) {
                assertFalse(Files.readString(archivo).contains("com.metronet.backend.service."), archivo.toString());
            }
        }
    }

    @Test
    void inicializadorSoloCoordinaElCatalogo() throws Exception {
        String fuente = Files.readString(FUENTES.resolve("configuracion/InicializadorCatalogoEscenariosProgresivos.java"));
        assertFalse(fuente.contains("JdbcTemplate"));
        assertFalse(SQL.matcher(fuente).find());
        assertTrue(fuente.contains("catalogo.inicializar()"));
    }
}
