package com.metronet.backend.dto;

// Metadatos de presentación derivados del intento y la campaña; no se persisten.
public record InicioEscenarioResponse(Integer idDiseno, Integer idEscenario, Integer idIntento,
                                     String estado, int numeroCampana, boolean mostrarTutorial) {}
