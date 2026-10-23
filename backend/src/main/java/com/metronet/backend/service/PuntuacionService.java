package com.metronet.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.CondicionConsignaResponse;
import com.metronet.backend.dto.DesempenoNivelResponse.MedicionUnidad;
import com.metronet.backend.dto.DesempenoNivelResponse;
import com.metronet.backend.dto.DesglosePuntuacionResponse;
import com.metronet.backend.dto.RankingResponse;
import com.metronet.backend.repository.PuntuacionRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.stereotype.Service;

/** Puntuación educativa de redes válidas. Las metas son configuración didáctica, no límites reales de operación. */
@Service
public class PuntuacionService {
    private static final String MARCA = " [METRONET-RED-v1:";
    private final PuntuacionRepository repositorio;
    private final ObjectMapper mapper;
    private final DistanciasRedService distancias;
    private final VinculoUvUtLibre vinculoLibre;

    @org.springframework.beans.factory.annotation.Autowired
    public PuntuacionService(
        PuntuacionRepository repositorio,
        ObjectMapper mapper,
        DistanciasRedService distancias,
        VinculoUvUtLibre vinculoLibre
    ) {
        this.repositorio = repositorio; this.mapper = mapper; this.distancias = distancias;
        this.vinculoLibre = vinculoLibre;
    }

    public int maximo(String reglas) {
        return 100;
    }

    private JsonNode configuracion(String reglas) {
        try { return mapper.readTree(reglas == null ? "{}" : reglas).path("puntuacion"); }
        catch (Exception e) { throw new IllegalStateException("Configuración de puntuación ilegible", e); }
    }

    /** Cada condición obligatoria pesa lo mismo; se redondea una sola vez. */
    public static int normalizar(List<CondicionConsignaResponse> condiciones) {
        if (condiciones.isEmpty()) return 0;
        long satisfechas = condiciones.stream().filter(CondicionConsignaResponse::completado).count();
        return (int) Math.round(100d * satisfechas / condiciones.size());
    }

    /** Las interacciones se comprueban comparando ejecuciones persistidas del mismo intento. */
    public List<CondicionConsignaResponse> condicionesCirculacion(int idDiseno, int idIntento, String reglas, boolean requiereSimulacion) {
        return condicionesCirculacion(idDiseno, idIntento, reglas, requiereSimulacion, false);
    }

    public List<CondicionConsignaResponse> condicionesCirculacion(int idDiseno, int idIntento, String reglas,
            boolean requiereSimulacion, boolean escalaUt) {
        List<CondicionConsignaResponse> condiciones = new ArrayList<>();
        JsonNode aprendizaje, recorrido;
        try {
            JsonNode configuracion = mapper.readTree(reglas == null ? "{}" : reglas);
            aprendizaje = configuracion.path("aprendizajeSimulacion");
            recorrido = configuracion.path("configuracionRecorrido");
        }
        catch (Exception e) { throw new IllegalStateException("Reglas de simulación ilegibles", e); }
        if (configuracion(reglas).has("velocidadObjetivoKmh")) {
            // Un escenario personalizado antiguo requiere revisión explícita;
            // su meta física no se convierte en UV ni se da por satisfecha.
            condiciones.add(new CondicionConsignaResponse("configuracionEscala",
                "Consigna con escala anterior: solicitar actualización al administrador", 0, 1, false));
        }
        if (!requiereSimulacion && aprendizaje.isMissingNode()) return condiciones;
        var ejecuciones = repositorio.ejecucionesIntento((r, fila) -> new Ejecucion(r.getDouble("duracion"), r.getString("comentarios"), RegistroSimulacionDidactica.leer(r.getString("comentarios"))), idIntento);
        Set<String> realizadas = new HashSet<>();
        String estructuraActual = marcaEstructura(idDiseno);
        for (int i = 1; i < ejecuciones.size(); i++) {
            Ejecucion anterior = ejecuciones.get(i - 1), actual = ejecuciones.get(i);
            if (anterior.registro == null || actual.registro == null
                || !Objects.equals(anterior.registro.escala(), actual.registro.escala())
                || !estructuraActual.equals(anterior.registro.estructura()) || !estructuraActual.equals(actual.registro.estructura())) continue;
            List<MedicionUnidad> antes = anterior.registro.unidades(), despues = actual.registro.unidades();
            if (antes.isEmpty() || antes.size() != despues.size()) continue;
            Map<Integer, Double> velocidades = new HashMap<>();
            antes.forEach(u -> velocidades.put(u.idTren(), u.velocidad()));
            if (despues.stream().anyMatch(u -> !velocidades.containsKey(u.idTren()))) continue;
            long cambios = despues.stream().filter(u -> Double.compare(velocidades.get(u.idTren()), u.velocidad()) != 0).count();
            Map<Integer, MedicionUnidad> previas = new HashMap<>();
            antes.forEach(u -> previas.put(u.idTren(), u));
            boolean horas = despues.stream().anyMatch(u -> u.tiempoEfectivo(actual.duracion) != previas.get(u.idTren()).tiempoEfectivo(anterior.duracion));
            if (actual.registro.esVinculada()) {
                realizadas.addAll(ComparacionLineasVinculadas.evaluar(anterior.registro, actual.registro));
                continue;
            }
            if (cambios > 0 && !horas) realizadas.add("velocidad");
            if (horas && cambios == 0) realizadas.add("duracion");
            if (despues.size() > 1 && cambios == 1 && !horas) realizadas.add("individual");
            if (despues.size() > 1 && cambios == despues.size() && !horas
                && despues.stream().map(MedicionUnidad::velocidad).distinct().count() == 1) realizadas.add("global");
            if (cambios > 0 && horas) realizadas.add("combinacion");
        }
        Map<String, String> textos = Map.of(
            "velocidad", "Cambiar UV de la línea y simular su UT calculada",
            "duracion", "Cambiar UT de la línea y simular su UV calculada",
            "individual", "Cambiar UV de una línea y simular sin modificar las demás",
            "global", "Aplicar una misma UV a todas las líneas y simular sus tiempos",
            "combinacion", "Comparar dos configuraciones proporcionales de la misma red");
        for (String clave : List.of("velocidad", "duracion", "individual", "global", "combinacion")) {
            if (!aprendizaje.path(clave).asBoolean()) continue;
            boolean cumplida = realizadas.contains(clave);
            condiciones.add(new CondicionConsignaResponse("aprendizajeSimulacion:" + clave,
                escalaUt ? textos.get(clave).replace("horas", "UT") : textos.get(clave), cumplida ? 1 : 0, 1, cumplida));
        }
        if (requiereSimulacion) {
            boolean actual = escalaUt && !vinculoLibre.aplica(idDiseno) ? simulacionVigenteUvUt(idIntento, idDiseno)
                : !ejecuciones.isEmpty() && ejecuciones.getLast().registro != null
                    && ejecuciones.getLast().comentarios.endsWith(marcaRed(idDiseno));
            actual = actual && MetasRecorrido.practica(recorrido.path("practica").asText(),
                ejecuciones.isEmpty() ? null : ejecuciones.getLast().registro);
            condiciones.add(new CondicionConsignaResponse("simulacionActual", "Simular la red y sus UV/UT actuales", actual ? 1 : 0, 1, actual));
        }
        return condiciones;
    }

    private record Ejecucion(double duracion, String comentarios, RegistroSimulacionDidactica registro) {}

    public DesempenoNivelResponse calcular(int idDiseno, String reglas, List<CondicionConsignaResponse> condiciones) {
        JsonNode c = configuracion(reglas);
        boolean redResuelta = !condiciones.isEmpty() && condiciones.stream()
            .filter(condicion -> !Set.of("requiereSimulacion", "simulacionActual", "criterioUvUt").contains(condicion.clave()) && !condicion.clave().startsWith("aprendizajeSimulacion:"))
            .allMatch(CondicionConsignaResponse::completado);
        boolean aprendizajeCumplido = condiciones.stream().filter(condicion -> condicion.clave().startsWith("aprendizajeSimulacion:"))
            .allMatch(CondicionConsignaResponse::completado);
        boolean simulacionActual = condiciones.stream().filter(condicion -> Set.of("requiereSimulacion", "simulacionActual", "criterioUvUt").contains(condicion.clave()))
            .allMatch(CondicionConsignaResponse::completado);
        int puntos = normalizar(condiciones);
        long satisfechas = condiciones.stream().filter(CondicionConsignaResponse::completado).count();
        String etapa = !redResuelta ? "RED" : !aprendizajeCumplido ? "EXPERIMENTAR" : !simulacionActual ? "SIMULACION" : "LISTO";
        String explicacion = condiciones.isEmpty() ? "Este diseño no tiene criterios de evaluación: no se asignan puntos."
            : satisfechas + " de " + condiciones.size() + " criterios satisfechos: " + puntos + "/100. Cada criterio obligatorio tiene el mismo peso."
                + " El tutorial, los errores y el tiempo no descuentan puntos."
                + (satisfechas < condiciones.size() ? " Aún quedan condiciones por cumplir antes de completar el nivel." : " Todos los criterios están satisfechos.");
        var politica = PoliticaPuntuacion.leer(c);
        if (politica != null) {
            var desglose = desglose(politica, registros(idDiseno));
            String detalle = desglose.puntosBase() + " puntos iniciales − " + desglose.totalDescontado()
                + " de descuentos = " + desglose.total() + " puntos. "
                + satisfechas + " de " + condiciones.size() + " condiciones satisfechas. "
                + (satisfechas < condiciones.size() ? "Todavía debés cumplir toda la consigna. " : "Toda la consigna está cumplida. ")
                + (politica.descuentoPorExceso() > 0
                    ? "El tutorial no descuenta. Los excesos descuentan desde la primera simulación."
                    : "El tutorial y las prácticas gratuitas no descuentan.");
            return new DesempenoNivelResponse(desglose.total(), politica.puntosBase(), desglose.total(), 0, 0,
                redResuelta, aprendizajeCumplido, simulacionActual, etapa, detalle, medirUnidades(idDiseno), null, null, desglose);
        }
        // Se conserva el desglose de puntos; no hay bonos por valores de velocidad.
        return new DesempenoNivelResponse(puntos, 100, puntos, 0, 0,
            redResuelta, aprendizajeCumplido, simulacionActual,
            etapa, explicacion, c.isMissingNode() ? List.of() : medirUnidades(idDiseno));
    }

    private record RegistroGuardado(int idSimulacion, String comentarios, RegistroSimulacionDidactica registro) {}

    private List<RegistroGuardado> registros(int idDiseno) {
        return repositorio.registros((r, fila) -> new RegistroGuardado(r.getInt(1), r.getString(2),
                RegistroSimulacionDidactica.leer(r.getString(2))), idDiseno);
    }

    private DesglosePuntuacionResponse desglose(PoliticaPuntuacion politica, List<RegistroGuardado> registros) {
        var descuentos = registros.stream().filter(r -> r.registro() != null && r.registro().puntuacion() != null)
            .filter(r -> politica.version().equals(r.registro().puntuacion().version()) && r.registro().puntuacion().descuento() > 0)
            .map(r -> new DesglosePuntuacionResponse.Descuento(r.idSimulacion(), r.registro().puntuacion().numeroEjecucion(),
                r.registro().puntuacion().descuento(), r.registro().puntuacion().condicionesPendientes(),
                r.registro().puntuacion().excesos())).toList();
        int total = Math.min(politica.descuentoMaximo(), descuentos.stream().mapToInt(DesglosePuntuacionResponse.Descuento::puntos).sum());
        return new DesglosePuntuacionResponse(politica.version(), politica.puntosBase(), politica.practicasGratuitas(),
            politica.descuentoPorEjecucionSinAvance(), politica.descuentoMaximo(), politica.puntajeMinimoAprobacion(),
            total, politica.puntosBase() - total, descuentos);
    }

    /** Se llama dentro de la transacción de ejecución, con el usuario bloqueado. Nunca desde una consulta. */
    public void registrarEjecucion(int idDiseno, int idSimulacion, String reglas,
            List<CondicionConsignaResponse> condiciones, List<String> excesosOperacion) {
        var politica = PoliticaPuntuacion.leer(configuracion(reglas));
        if (politica == null) return;
        var registros = registros(idDiseno);
        var actual = registros.stream().filter(r -> r.idSimulacion() == idSimulacion).findFirst()
            .orElseThrow(() -> new IllegalStateException("Falta la ejecución que se desea evaluar"));
        if (actual.registro() == null) throw new IllegalStateException("Falta la instantánea de la ejecución");
        if (actual.registro().puntuacion() != null) return;
        var anteriores = registros.stream().filter(r -> r.idSimulacion() < idSimulacion && r.registro() != null)
            .map(r -> r.registro().puntuacion()).filter(Objects::nonNull)
            .filter(r -> politica.version().equals(r.version())).toList();
        int numero = (int) registros.stream().filter(r -> r.idSimulacion() <= idSimulacion).count();
        var evaluacion = politica.evaluar(condiciones, anteriores, numero, excesosOperacion);
        var instantanea = new RegistroSimulacionDidactica(actual.registro().estructura(), actual.registro().unidades(), evaluacion, actual.registro().escala(), actual.registro().referencias());
        // Conserva exactamente la huella evaluada, al final, como esperan los lectores existentes.
        String huella = actual.comentarios().substring(actual.comentarios().lastIndexOf(MARCA));
        repositorio.registrarPuntaje(
            comentarioVisible(actual.comentarios()) + instantanea.codificar() + huella,
            politica.puntosBase() - evaluacion.totalDescontado(),
            idSimulacion
        );
    }

    public List<MedicionUnidad> medirUnidades(int idDiseno) {
        var longitudes = distancias.porLinea(idDiseno);
        return repositorio.medicionesUnidades((r, fila) -> new MedicionUnidad(r.getInt("id_tren"), r.getString("nombre_linea"),
                r.getDouble("velocidad_promedio"), r.getInt("tramos"), (r.getBigDecimal("duracion_ut") == null ? null : r.getBigDecimal("duracion_ut").doubleValue()), longitudes.getOrDefault(r.getString("nombre_linea"), 0d), null, null), idDiseno);
    }

    public String marcaDidactica(int idDiseno, double duracionGlobal) {
        var unidades = medirUnidades(idDiseno).stream().map(u -> new MedicionUnidad(u.idTren(), u.linea(), u.velocidad(), u.tramos(), u.tiempoEfectivo(duracionGlobal), u.distanciaKm(),
            Math.min(u.distanciaKm(), u.velocidad() * u.tiempoEfectivo(duracionGlobal)),
            u.velocidad() > 0 ? u.distanciaKm() / u.velocidad() : null)).toList();
        var referencias = new java.util.LinkedHashMap<String, String>();
        boolean vinculada = vinculoLibre.aplica(idDiseno);
        if (vinculada) repositorio.referenciasLineas(r -> {
            referencias.put(r.getString(1), r.getString(2));
        }, idDiseno);
        return new RegistroSimulacionDidactica(marcaEstructura(idDiseno), unidades, null,
            vinculada ? RegistroSimulacionDidactica.ESCALA_VINCULADA : RegistroSimulacionDidactica.ESCALA_FISICA,
            vinculada ? referencias : null).codificar() + marcaRed(idDiseno);
    }

    public String marcaDidactica(int idDiseno) {
        return new RegistroSimulacionDidactica(marcaEstructura(idDiseno), medirUnidades(idDiseno), null, RegistroSimulacionDidactica.ESCALA_FISICA).codificar() + marcaRed(idDiseno);
    }

    private String marcaEstructura(int idDiseno) { return marcaRed(idDiseno, false); }

    /** V2 compara solo componentes que intervienen en recorridos y asignación UV. */
    public String marcaProblemaUvUt(int idDiseno) { return "km-v3:" + marcaRed(idDiseno, false, false); }
    public String marcaEjecucionUvUt(int idDiseno) { return "km-v3:" + marcaRed(idDiseno, true, false); }

    /** Identifica la red y sus velocidades tal como fueron simuladas, usando el campo comentarios existente. */
    public String marcaRed(int idDiseno) { return marcaRed(idDiseno, true); }

    private String marcaRed(int idDiseno, boolean incluirVelocidad) { return marcaRed(idDiseno, incluirVelocidad, true); }

    private String marcaRed(int idDiseno, boolean incluirVelocidad, boolean incluirCapacidad) {
        try {
            boolean incluirDuracion = incluirVelocidad && Boolean.TRUE.equals(repositorio.tieneDuracion(idDiseno));
            var datos = List.of(
                repositorio.estacionesOrdenadas(idDiseno),
                repositorio.lineasOrdenadas(idDiseno),
                repositorio.conexionesOrdenadas(idDiseno),
                repositorio.tramosOrdenados(idDiseno),
                repositorio.unidadesOrdenadas(incluirVelocidad, incluirDuracion, incluirCapacidad, idDiseno));
            var enlaces = repositorio.enlacesOrdenados(idDiseno);
            // Preserva la huella histórica cuando la red no contiene conexiones entre líneas.
            var datosCompletos = new java.util.ArrayList<Object>(datos);
            if (enlaces != null && !enlaces.isEmpty()) datosCompletos.add(enlaces);
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsString(datosCompletos).getBytes(StandardCharsets.UTF_8));
            return MARCA + HexFormat.of().formatHex(hash) + "]";
        } catch (Exception e) { throw new IllegalStateException("No fue posible identificar la red simulada", e); }
    }

    private boolean simulacionVigenteUvUt(int idIntento, int idDiseno) {
        var ultima = repositorio.huellaUltimaEjecucion((r, fila) -> r.getString(1), idIntento);
        return !ultima.isEmpty() && ultima.getFirst().equals(marcaEjecucionUvUt(idDiseno));
    }

    public static String comentarioVisible(String comentario) {
        if (comentario == null) return "";
        int indice = comentario.indexOf(RegistroSimulacionDidactica.MARCA_V3);
        if (indice < 0) indice = comentario.indexOf(RegistroSimulacionDidactica.MARCA_V2);
        if (indice < 0) indice = comentario.indexOf(RegistroSimulacionDidactica.MARCA);
        if (indice < 0) indice = comentario.lastIndexOf(MARCA);
        return indice < 0 ? comentario : comentario.substring(0, indice);
    }

    public RankingResponse ranking(int idUsuario) {
        var filas = repositorio.ranking((r, fila) -> {
                String nombre = r.getString("nombre");
                String apellido = r.getString("apellido");
                String nombreVisible = ((nombre == null ? "" : nombre.trim()) + " "
                    + (apellido == null ? "" : apellido.trim())).trim();
                return new RankingResponse.Entrada(fila + 1, nombreVisible.isEmpty() ? "Jugador " + r.getInt("id_usuario") : nombreVisible,
                    r.getInt("total"), r.getInt("completados"), r.getInt("id_usuario") == idUsuario);
            });
        var propio = filas.stream().filter(RankingResponse.Entrada::sosVos).findFirst();
        int maximo = repositorio.reglasNiveles((r, fila) -> maximo(r.getString("reglas_exito"))).stream().mapToInt(Integer::intValue).sum();
        return new RankingResponse(filas, propio.map(RankingResponse.Entrada::posicion).orElse(null), propio.map(RankingResponse.Entrada::puntajeTotal).orElse(0), maximo);
    }
}
