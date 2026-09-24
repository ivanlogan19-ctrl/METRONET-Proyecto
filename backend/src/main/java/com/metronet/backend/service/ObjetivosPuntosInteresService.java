package com.metronet.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.PuntoInteresObjetivoResponse;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ObjetivosPuntosInteresService {
    private final ObjectMapper objectMapper;

    private final GeografiaService geografia;

    public ObjetivosPuntosInteresService(ObjectMapper objectMapper, GeografiaService geografia) {
        this.objectMapper = objectMapper;
        this.geografia = geografia;
    }

    public List<PuntoInteresObjetivoResponse> obtenerObjetivos(String reglasExito) {
        if (reglasExito == null || reglasExito.isBlank()) return List.of();
        try {
            JsonNode reglas = objectMapper.readTree(reglasExito);
            if (reglas == null || !reglas.isObject()) return List.of();
            JsonNode objetivos = reglas.path("puntosInteresObjetivo");
            if (!objetivos.isArray()) return List.of();
            List<PuntoInteresObjetivoResponse> respuesta = new ArrayList<>();
            for (JsonNode objetivo : objetivos) {
                PuntoInteresObjetivoResponse punto = convertirObjetivo(objetivo);
                if (punto != null) respuesta.add(punto);
            }
            return List.copyOf(respuesta);
        } catch (JsonProcessingException error) {
            return List.of();
        }
    }

    private PuntoInteresObjetivoResponse convertirObjetivo(JsonNode objetivo) {
        if (!objetivo.isObject()) return null;
        Integer id = obtenerEntero(objetivo, "idPunto", "puntoId", "id");
        if (id == null && (objetivo.hasNonNull("idPunto") || objetivo.hasNonNull("puntoId") || objetivo.hasNonNull("id"))) return null;
        GeografiaService.Punto punto = geografia.resolverPunto(id, obtenerTexto(objetivo, "nombrePunto", "nombre"));
        BigDecimal radio = obtenerDecimal(objetivo, "radioCobertura");
        if (punto == null || radio == null || radio.signum() <= 0) return null;
        return new PuntoInteresObjetivoResponse(punto.id(), punto.nombre(), geografia.posicionX(punto), geografia.posicionY(punto), radio);
    }

    public List<String> obtenerErrores(String reglasExito) {
        try {
            JsonNode reglas = objectMapper.readTree(reglasExito == null ? "{}" : reglasExito);
            if (reglas == null || !reglas.isObject()) return List.of("La configuración de los POI no es válida.");
            if (!reglas.path("requiereCoberturaPuntosInteres").asBoolean() && !reglas.path("requiereObjetivosMismaLinea").asBoolean()) return List.of();
            JsonNode objetivos = reglas.path("puntosInteresObjetivo");
            if (!objetivos.isArray() || objetivos.isEmpty()) return List.of("El escenario requiere POI pero no tiene objetivos configurados.");
            List<String> errores = new ArrayList<>();
            for (JsonNode objetivo : objetivos) {
                if (convertirObjetivo(objetivo) == null) {
                    String referencia = objetivo.path("idPunto").asText(objetivo.path("nombrePunto").asText("sin referencia"));
                    errores.add("POI " + referencia + ": referencia inexistente o ambigua, o radio de cobertura inválido.");
                }
            }
            return List.copyOf(errores);
        } catch (JsonProcessingException error) {
            return List.of("La configuración de los POI no es válida.");
        }
    }

    private Integer obtenerEntero(JsonNode objetivo, String... claves) {
        for (String clave : claves) {
            JsonNode valor = objetivo.path(clave);
            if (valor.isIntegralNumber() && valor.canConvertToInt()) return valor.intValue();
        }
        return null;
    }

    private String obtenerTexto(JsonNode objetivo, String... claves) {
        for (String clave : claves) {
            JsonNode valor = objetivo.path(clave);
            if (valor.isTextual() && !valor.asText().isBlank()) return valor.asText().trim();
        }
        return null;
    }

    private BigDecimal obtenerDecimal(JsonNode objetivo, String clave) {
        JsonNode valor = objetivo.path(clave);
        return valor.isNumber() ? valor.decimalValue() : null;
    }
}
