package com.metronet.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.DesempenoNivelResponse.MedicionUnidad;
import java.util.Base64;
import java.util.List;

/** Instantánea versionada en comentarios, junto a la huella existente. No convierte históricos. */
public record RegistroSimulacionDidactica(String estructura, List<MedicionUnidad> unidades) {
    public static final String MARCA = " [METRONET-UV-H-v1:";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public String codificar() {
        try {
            return MARCA + Base64.getUrlEncoder().withoutPadding().encodeToString(MAPPER.writeValueAsBytes(this)) + "]";
        } catch (Exception e) { throw new IllegalStateException("No fue posible registrar la escala de simulación", e); }
    }

    public static RegistroSimulacionDidactica leer(String comentario) {
        if (comentario == null || !comentario.contains(MARCA)) return null;
        try {
            int inicio = comentario.indexOf(MARCA) + MARCA.length();
            String datos = comentario.substring(inicio, comentario.indexOf(']', inicio));
            var registro = MAPPER.readValue(Base64.getUrlDecoder().decode(datos), RegistroSimulacionDidactica.class);
            return registro.estructura() == null || registro.unidades() == null ? null : registro;
        } catch (Exception e) { return null; }
    }
}
