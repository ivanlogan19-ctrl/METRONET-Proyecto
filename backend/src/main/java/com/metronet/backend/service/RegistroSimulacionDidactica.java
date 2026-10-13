package com.metronet.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metronet.backend.dto.DesempenoNivelResponse.MedicionUnidad;
import java.util.Base64;
import java.util.List;

/** Instantánea versionada en comentarios, junto a la huella existente. No convierte históricos. */
public record RegistroSimulacionDidactica(String estructura, List<MedicionUnidad> unidades, PoliticaPuntuacion.Registro puntuacion, String escala) {
    public RegistroSimulacionDidactica(String estructura, List<MedicionUnidad> unidades, PoliticaPuntuacion.Registro puntuacion) {
        this(estructura, unidades, puntuacion, null);
    }
    public RegistroSimulacionDidactica(String estructura, List<MedicionUnidad> unidades) {
        this(estructura, unidades, null);
    }
    public static final String MARCA = " [METRONET-UV-H-v1:";
    public static final String MARCA_V2 = " [METRONET-UV-H-v2:";
    public static final String MARCA_V3 = " [METRONET-UV-KM-v3:";
    public static final String ESCALA_FISICA = "UV_KM_UT_V3";
    public boolean esFisica() { return ESCALA_FISICA.equals(escala); }
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public String codificar() {
        try {
            return (esFisica() ? MARCA_V3 : puntuacion == null ? MARCA : MARCA_V2) + Base64.getUrlEncoder().withoutPadding().encodeToString(MAPPER.writeValueAsBytes(this)) + "]";
        } catch (Exception e) { throw new IllegalStateException("No fue posible registrar la escala de simulación", e); }
    }

    public static RegistroSimulacionDidactica leer(String comentario) {
        if (comentario == null) return null;
        String marca = comentario.contains(MARCA_V3) ? MARCA_V3 : comentario.contains(MARCA_V2) ? MARCA_V2 : MARCA;
        if (!comentario.contains(marca)) return null;
        try {
            int inicio = comentario.indexOf(marca) + marca.length();
            String datos = comentario.substring(inicio, comentario.indexOf(']', inicio));
            var registro = MAPPER.readValue(Base64.getUrlDecoder().decode(datos), RegistroSimulacionDidactica.class);
            return registro.estructura() == null || registro.unidades() == null ? null : registro;
        } catch (Exception e) { return null; }
    }
}
