package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import com.metronet.backend.dto.*;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.*;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@EnabledIfEnvironmentVariable(named="METRONET_TEST_POSTGRES_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/metronet_pruebas")
class ConexionesLineasPostgresTest {
    @Test void guardarRetiraSoloLineasSinElementosYUnMetroRecorreLaCurva() {
        int usuario = usuario();
        int diseno = simulaciones.crearSimulacion(usuario,Rol.ADMIN,new CrearSimulacionRequest("Curva completa")).idDiseno();
        simulaciones.crearEstacion(usuario,diseno,new CrearEstacionSimulacionRequest("A",new BigDecimal("620"),new BigDecimal("430")));
        simulaciones.crearEstacion(usuario,diseno,new CrearEstacionSimulacionRequest("B",new BigDecimal("650"),new BigDecimal("430")));
        simulaciones.crearEstacion(usuario,diseno,new CrearEstacionSimulacionRequest("C",new BigDecimal("650"),new BigDecimal("400")));
        simulaciones.crearLinea(usuario,diseno,new CrearLineaSimulacionRequest("Amarilla",List.of("A","B","C")));
        simulaciones.crearUnidadMetro(usuario,diseno,new CrearUnidadMetroSimulacionRequest("Amarilla",300,BigDecimal.ONE));
        jdbc.update("INSERT INTO linea(id_diseno,nombre) VALUES (?,?)",diseno,"Vacía residual");
        simulaciones.guardarDiseno(usuario,diseno);
        var red = simulaciones.obtenerSimulacion(usuario,diseno);
        assertEquals(1,red.lineas().size());
        assertEquals(2,red.tramos().size());
        assertEquals(1,red.unidadesMetro().size());
        assertTrue(simulaciones.validarDiseno(usuario,diseno).preparadoParaSimular());
        simulaciones.crearEstacion(usuario,diseno,new CrearEstacionSimulacionRequest("D",new BigDecimal("670"),new BigDecimal("400")));
        simulaciones.crearLinea(usuario,diseno,new CrearLineaSimulacionRequest("Azul",List.of("C","D")));
        simulaciones.guardarDiseno(usuario,diseno);
        assertEquals(2,simulaciones.obtenerSimulacion(usuario,diseno).lineas().size());
        assertFalse(simulaciones.validarDiseno(usuario,diseno).preparadoParaSimular(),"Una línea real sin metro todavía requiere su unidad");
        simulaciones.eliminarTramo(usuario,diseno,"Azul","C","D");
        assertEquals(1,simulaciones.obtenerSimulacion(usuario,diseno).lineas().size(),"Eliminar el último tramo sin metros no deja una línea fantasma");
    }
    @Test void conexionDesdeEstacionSueltaCruzaLaLineaYContinuaSinDividirla() {
        int usuario = usuario();
        int diseno = simulaciones.crearSimulacion(usuario,Rol.ADMIN,new CrearSimulacionRequest("Cruce trazado")).idDiseno();
        String[] nombres = {"Arriba","Centro","Abajo","Izquierda","Derecha"};
        int[][] posiciones = {{650,400},{650,430},{650,460},{620,430},{680,430}};
        for (int i=0;i<nombres.length;i++) simulaciones.crearEstacion(usuario,diseno,
            new CrearEstacionSimulacionRequest(nombres[i],BigDecimal.valueOf(posiciones[i][0]),BigDecimal.valueOf(posiciones[i][1])));
        simulaciones.crearLinea(usuario,diseno,new CrearLineaSimulacionRequest("Azul",List.of("Arriba","Centro","Abajo")));
        var conexion = simulaciones.crearConexionLineas(usuario,diseno,new ConexionLineasRequest("Rosa","Izquierda","Azul","Centro"));
        simulaciones.extenderLinea(usuario,diseno,new ActualizarTramoRequest("Rosa","Centro","Derecha"));
        simulaciones.crearUnidadMetro(usuario,diseno,new CrearUnidadMetroSimulacionRequest("Azul",300,BigDecimal.ONE));
        assertFalse(simulaciones.validarDiseno(usuario,diseno).preparadoParaSimular());
        simulaciones.crearUnidadMetro(usuario,diseno,new CrearUnidadMetroSimulacionRequest("Rosa",300,BigDecimal.ONE));
        simulaciones.guardarDiseno(usuario,diseno);
        var red = simulaciones.obtenerSimulacion(usuario,diseno);
        assertEquals(5,red.estaciones().size());
        assertEquals(2,red.lineas().size());
        assertEquals(4,red.tramos().size());
        assertEquals(2,red.unidadesMetro().size());
        assertEquals("Centro",conexion.estacionA());
        assertEquals("Centro",conexion.estacionB());
        assertTrue(simulaciones.validarDiseno(usuario,diseno).preparadoParaSimular());
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM tramo WHERE id_diseno=? AND nombre_linea='Rosa' AND nombre_estacion_a='Centro' AND nombre_estacion_b='Derecha'",Integer.class,diseno));
    }

    @DynamicPropertySource static void base(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> System.getenv("METRONET_TEST_POSTGRES_URL"));
        r.add("spring.datasource.username", () -> System.getenv("METRONET_TEST_POSTGRES_USER"));
        r.add("spring.datasource.password", () -> System.getenv("METRONET_TEST_POSTGRES_PASSWORD"));
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired SimulacionService simulaciones;
    @Autowired com.metronet.backend.repository.JuegoEducativoRepository metas;
    @Autowired DisenoAdministracionService administracion;
    @MockitoBean ServicioCorreo correo;

    private int usuario() {
        return jdbc.queryForObject("INSERT INTO usuario(nombre,email,password,rol) VALUES ('Conexiones QA',?,'!sin-acceso','ADMIN') RETURNING id_usuario", Integer.class, "conexion-" + java.util.UUID.randomUUID() + "@example.test");
    }

    @Test void cruceTeYDosExtremosPersistenSinMetroPropioYConParametrosIndependientes() {
        int usuario = usuario();
        for (int variante = 0; variante < 3; variante++) {
            int diseno = simulaciones.crearSimulacion(usuario, Rol.ADMIN, new CrearSimulacionRequest("Estación compartida")).idDiseno();
            String[] nombres = {"A", "Compartida", "B", "C", "D"};
            int[][] posiciones = {{610,430},{640,430},{670,430},{640,400},{640,460}};
            for (int i=0;i<nombres.length;i++) simulaciones.crearEstacion(usuario, diseno,
                new CrearEstacionSimulacionRequest(nombres[i], BigDecimal.valueOf(posiciones[i][0]), BigDecimal.valueOf(posiciones[i][1])));
            var azul = variante < 2 ? List.of("A","Compartida","B") : List.of("A","Compartida");
            var amarilla = variante == 0 ? List.of("C","Compartida","D") : List.of("C","Compartida");
            simulaciones.crearLinea(usuario, diseno, new CrearLineaSimulacionRequest("Azul", azul));
            simulaciones.crearLinea(usuario, diseno, new CrearLineaSimulacionRequest("Amarilla", amarilla));
            for (String nombre : nombres) if (!azul.contains(nombre) && !amarilla.contains(nombre)) simulaciones.eliminarEstacion(usuario,diseno,nombre);
            var conexion = simulaciones.crearConexionLineas(usuario, diseno, new ConexionLineasRequest("Azul","Compartida","Amarilla","Compartida"));
            assertEquals(conexion.estacionA(), conexion.estacionB());
            assertNull(conexion.distanciaKm());
            var metro = simulaciones.crearUnidadMetro(usuario,diseno,new CrearUnidadMetroSimulacionRequest("Azul",300,BigDecimal.ONE));
            simulaciones.crearUnidadMetro(usuario,diseno,new CrearUnidadMetroSimulacionRequest("Amarilla",300,BigDecimal.ONE));
            assertEquals(400, assertThrows(ResponseStatusException.class, () -> simulaciones.crearUnidadMetro(usuario,diseno,
                new CrearUnidadMetroSimulacionRequest(null,300,BigDecimal.ONE,conexion.idConexion()))).getStatusCode().value());
            simulaciones.actualizarUnidadMetro(usuario,diseno,metro.idTren(),new ActualizarUnidadMetroRequest("Azul",300,new BigDecimal("2"),null,"UV"));
            simulaciones.guardarDiseno(usuario,diseno);
            var abierta = simulaciones.obtenerSimulacion(usuario,diseno);
            assertEquals(2,abierta.unidadesMetro().size());
            assertEquals(2.0,abierta.unidadesMetro().stream().filter(m -> m.nombreLinea().equals("Azul")).findFirst().orElseThrow().velocidadPromedio().doubleValue());
            assertEquals(1.0,abierta.unidadesMetro().stream().filter(m -> m.nombreLinea().equals("Amarilla")).findFirst().orElseThrow().velocidadPromedio().doubleValue());
            assertTrue(simulaciones.validarDiseno(usuario,diseno).preparadoParaSimular());
            simulaciones.validarDiseno(usuario,diseno);
            int copia = simulaciones.crearEscenario(usuario,diseno,new CrearEscenarioRequest("Copia", "NIVEL", "Inicial",null,null)).idDiseno();
            assertEquals(2,simulaciones.obtenerSimulacion(usuario,copia).unidadesMetro().size());
            assertEquals(1,simulaciones.obtenerSimulacion(usuario,copia).conexionesLineas().size());
            simulaciones.ejecutarSimulacion(usuario,diseno,new EjecutarSimulacionRequest(BigDecimal.ONE,2.0));
        }
    }

    @Test void conectarFusionaDosEstacionesSinAgregarTramosYPermiteContinuar() {
        int usuario = usuario();
        int diseno = simulaciones.crearSimulacion(usuario,Rol.ADMIN,new CrearSimulacionRequest("Extensión")).idDiseno();
        for (int i=0;i<5;i++) simulaciones.crearEstacion(usuario,diseno,new CrearEstacionSimulacionRequest("E"+i,BigDecimal.valueOf(610+i*15),BigDecimal.valueOf(430)));
        simulaciones.crearLinea(usuario,diseno,new CrearLineaSimulacionRequest("Azul",List.of("E0","E1")));
        simulaciones.crearLinea(usuario,diseno,new CrearLineaSimulacionRequest("Amarilla",List.of("E2","E3")));
        var antes = simulaciones.obtenerSimulacion(usuario,diseno);
        var conexion = simulaciones.crearConexionLineas(usuario,diseno,new ConexionLineasRequest("Azul","E1","Amarilla","E2"));
        simulaciones.extenderLinea(usuario,diseno,new ActualizarTramoRequest("Azul","E2","E4"));
        simulaciones.guardarDiseno(usuario,diseno);
        var despues = simulaciones.obtenerSimulacion(usuario,diseno);
        assertEquals(antes.estaciones().size()-1,despues.estaciones().size());
        assertTrue(despues.estaciones().stream().noneMatch(e -> e.nombre().equals("E1")));
        assertEquals(antes.lineas(),despues.lineas());
        assertEquals(2,despues.tramos().stream().filter(t -> t.nombreLinea().equals("Azul")).count());
        assertEquals(1,despues.tramos().stream().filter(t -> t.nombreLinea().equals("Amarilla")).count());
        assertEquals("E2",conexion.estacionA());
        assertEquals(antes.estaciones().size(),metas.contarEstaciones(diseno)+metas.contarEstacionesIntegradas(diseno),"La fusión conserva el total construido para las metas");
        simulaciones.actualizarEstacion(usuario,diseno,"E2",new ActualizarEstacionRequest("Compartida",BigDecimal.valueOf(640),BigDecimal.valueOf(430),false));
        assertEquals("Compartida",simulaciones.obtenerSimulacion(usuario,diseno).conexionesLineas().getFirst().estacionB());
        simulaciones.eliminarConexionLineas(usuario,diseno,conexion.idConexion());
        assertEquals(3,simulaciones.obtenerSimulacion(usuario,diseno).tramos().size());
        assertTrue(simulaciones.obtenerSimulacion(usuario,diseno).conexionesLineas().isEmpty());
    }
    @Test void migrarViaAnteriorConservaRedYArchivaSuMetro() throws java.io.IOException {
        int usuario = usuario();
        int diseno = simulaciones.crearSimulacion(usuario,Rol.ADMIN,new CrearSimulacionRequest("Migración")).idDiseno();
        for (int i=0;i<4;i++) simulaciones.crearEstacion(usuario,diseno,
            new CrearEstacionSimulacionRequest("E"+i,BigDecimal.valueOf(610+i*15),BigDecimal.valueOf(430)));
        simulaciones.crearLinea(usuario,diseno,new CrearLineaSimulacionRequest("Azul",List.of("E0","E1")));
        simulaciones.crearLinea(usuario,diseno,new CrearLineaSimulacionRequest("Amarilla",List.of("E2","E3")));
        simulaciones.crearUnidadMetro(usuario,diseno,new CrearUnidadMetroSimulacionRequest("Azul",300,BigDecimal.ONE));
        var estaciones = simulaciones.obtenerSimulacion(usuario,diseno).estaciones();
        // Restituir el esquema anterior exclusivamente dentro de esta transacción de prueba.
        jdbc.execute("DROP TRIGGER chk_conexion_estacion_compartida ON conexion_lineas");
        jdbc.execute("DROP FUNCTION validar_estacion_compartida()");
        jdbc.execute("DROP TABLE archivo_redes_conexion_via, archivo_intentos_conexion_via");
        jdbc.execute("ALTER TABLE metro DROP CONSTRAINT chk_metro_solo_linea");
        jdbc.execute("ALTER TABLE metro ALTER COLUMN nombre_linea DROP NOT NULL");
        long conexion = jdbc.queryForObject("INSERT INTO conexion_lineas(id_diseno,linea_a,estacion_a,linea_b,estacion_b) VALUES (?,'Azul','E1','Amarilla','E2') RETURNING id_conexion",Long.class,diseno);
        jdbc.update("INSERT INTO metro(id_diseno,id_conexion,capacidad,velocidad_promedio) VALUES (?,?,300,1)",diseno,conexion);
        String migracion = java.nio.file.Files.readString(java.nio.file.Path.of("../database/027_estaciones_compartidas.sql"));
        jdbc.execute(migracion.replace("BEGIN;\nLOCK TABLE", "LOCK TABLE").replace("COMMIT;", ""));
        var actual = simulaciones.obtenerSimulacion(usuario,diseno);
        assertEquals(estaciones,actual.estaciones());
        assertEquals(2,actual.lineas().size());
        assertEquals(3,actual.tramos().size());
        assertEquals("E2",actual.conexionesLineas().getFirst().estacionA());
        assertEquals("E2",actual.conexionesLineas().getFirst().estacionB());
        assertEquals(1,actual.unidadesMetro().size());
        assertEquals(2,jdbc.queryForObject("SELECT jsonb_array_length(red->'metros') FROM archivo_redes_conexion_via WHERE id_diseno=?",Integer.class,diseno));
    }

}
