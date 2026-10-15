package com.metronet.backend.service;

import com.metronet.backend.dto.DesempenoNivelResponse.MedicionUnidad;
import java.util.*;

/** Reconoce decisiones del jugador por línea; el valor dependiente no es otra acción. */
final class ComparacionLineasVinculadas {
    private ComparacionLineasVinculadas() {}

    static Set<String> evaluar(RegistroSimulacionDidactica antes, RegistroSimulacionDidactica despues) {
        Set<String> realizadas = new HashSet<>();
        if (!antes.esVinculada() || !despues.esVinculada() || !Objects.equals(antes.estructura(), despues.estructura())) return realizadas;
        Map<String, MedicionUnidad> previas = lineas(antes.unidades()), actuales = lineas(despues.unidades());
        if (!previas.keySet().equals(actuales.keySet()) || despues.referencias() == null) return realizadas;
        var cambiadas = actuales.values().stream().filter(u ->
            Double.compare(u.velocidad(), previas.get(u.linea()).velocidad()) != 0).toList();
        for (var u : cambiadas) {
            String referencia = despues.referencias().get(u.linea());
            if ("UV".equals(referencia)) realizadas.add("velocidad");
            if ("UT".equals(referencia)) realizadas.add("duracion");
        }
        if (!cambiadas.isEmpty()) realizadas.add("combinacion");
        if (actuales.size() > 1 && cambiadas.size() == 1 && realizadas.contains("velocidad")) realizadas.add("individual");
        if (!cambiadas.isEmpty() && cambiadas.size() == actuales.size()
            && cambiadas.stream().allMatch(u -> "UV".equals(despues.referencias().get(u.linea())))
            && cambiadas.stream().map(MedicionUnidad::velocidad).distinct().count() == 1) realizadas.add("global");
        return realizadas;
    }

    private static Map<String, MedicionUnidad> lineas(List<MedicionUnidad> unidades) {
        Map<String, MedicionUnidad> resultado = new LinkedHashMap<>();
        unidades.forEach(u -> resultado.putIfAbsent(u.linea(), u));
        return resultado;
    }
}
