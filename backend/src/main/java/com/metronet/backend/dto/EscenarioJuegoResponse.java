package com.metronet.backend.dto;

import java.util.Map;

public record EscenarioJuegoResponse(
    Integer idEscenario,
    Integer numero,
    String nombre,
    String objetivo,
    String dificultad,
    String instrucciones,
    String estado,
    Integer progreso,
    boolean desbloqueado,
    Map<String, Boolean> herramientasHabilitadas,
    boolean completadoEnCampanaActual,
    Integer cantidadIntentos,
    Integer mejorPuntaje,
    Integer ultimoPuntaje,
    Integer puntajeMaximo,
    Integer idIntento,
    String relato,
    Integer cantidadIntentosCampana,
    String recorrido
) {
    public EscenarioJuegoResponse(Integer idEscenario, Integer numero, String nombre, String objetivo, String dificultad, String instrucciones,
        String estado, Integer progreso, boolean desbloqueado, Map<String, Boolean> herramientasHabilitadas, boolean completadoEnCampanaActual,
        Integer cantidadIntentos, Integer mejorPuntaje, Integer ultimoPuntaje, Integer puntajeMaximo, Integer idIntento, String relato) {
        this(idEscenario,numero,nombre,objetivo,dificultad,instrucciones,estado,progreso,desbloqueado,herramientasHabilitadas,
            completadoEnCampanaActual,cantidadIntentos,mejorPuntaje,ultimoPuntaje,puntajeMaximo,idIntento,relato,null,null);
    }
    public EscenarioJuegoResponse(Integer idEscenario, Integer numero, String nombre, String objetivo, String dificultad, String instrucciones,
        String estado, Integer progreso, boolean desbloqueado, Map<String, Boolean> herramientasHabilitadas, boolean completadoEnCampanaActual,
        Integer cantidadIntentos, Integer mejorPuntaje, Integer ultimoPuntaje, Integer puntajeMaximo, Integer idIntento) {
        this(idEscenario,numero,nombre,objetivo,dificultad,instrucciones,estado,progreso,desbloqueado,herramientasHabilitadas,
            completadoEnCampanaActual,cantidadIntentos,mejorPuntaje,ultimoPuntaje,puntajeMaximo,idIntento,null);
    }
    public EscenarioJuegoResponse(Integer idEscenario, Integer numero, String nombre, String objetivo, String dificultad, String instrucciones,
        String estado, Integer progreso, boolean desbloqueado, Map<String, Boolean> herramientasHabilitadas, boolean completadoEnCampanaActual,
        Integer cantidadIntentos, Integer mejorPuntaje, Integer ultimoPuntaje, Integer puntajeMaximo) {
        this(idEscenario,numero,nombre,objetivo,dificultad,instrucciones,estado,progreso,desbloqueado,herramientasHabilitadas,
            completadoEnCampanaActual,cantidadIntentos,mejorPuntaje,ultimoPuntaje,puntajeMaximo,null);
    }
    public EscenarioJuegoResponse(Integer idEscenario, Integer numero, String nombre, String objetivo, String dificultad, String instrucciones,
        String estado, Integer progreso, boolean desbloqueado, Map<String, Boolean> herramientasHabilitadas, boolean completadoEnCampanaActual,
        Integer cantidadIntentos, Integer mejorPuntaje, Integer ultimoPuntaje) {
        this(idEscenario, numero, nombre, objetivo, dificultad, instrucciones, estado, progreso, desbloqueado, herramientasHabilitadas,
            completadoEnCampanaActual, cantidadIntentos, mejorPuntaje, ultimoPuntaje, numero == null ? null : 100,null);
    }
}
