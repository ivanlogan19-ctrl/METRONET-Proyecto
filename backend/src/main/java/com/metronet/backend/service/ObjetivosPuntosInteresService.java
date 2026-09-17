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

    public ObjetivosPuntosInteresService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<PuntoInteresObjetivoResponse> obtenerObjetivos(String reglasExito) {
        if (reglasExito == null || reglasExito.isBlank()) return List.of();
        try {
            JsonNode objetivos = objectMapper.readTree(reglasExito).path("puntosInteresObjetivo");
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
        BigDecimal posicionX = obtenerDecimal(objetivo, "posicionX");
        BigDecimal posicionY = obtenerDecimal(objetivo, "posicionY");
        BigDecimal radioCobertura = obtenerDecimal(objetivo, "radioCobertura");
        if (posicionX == null || posicionY == null || radioCobertura == null || radioCobertura.signum() <= 0) return null;
        return new PuntoInteresObjetivoResponse(
            obtenerEntero(objetivo, "idPunto", "puntoId", "id"),
            obtenerTexto(objetivo, "nombrePunto", "nombre"),
            posicionX,
            posicionY,
            radioCobertura
        );
    }

    private Integer obtenerEntero(JsonNode objetivo, String... claves) {
        for (String clave : claves) {
            JsonNode valor = objetivo.path(clave);
            if (valor.isIntegralNumber()) return valor.intValue();
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
