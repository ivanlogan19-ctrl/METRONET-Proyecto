package com.metronet.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;

/** Edición completa de un nivel fijo; el servidor conserva sus IDs de tarjetas. */
public record EdicionNivelRequest(
    Integer versionBase, Integer revisionEsperada, JsonNode desafio, JsonNode reglasExito,
    JsonNode herramientasHabilitadas, JsonNode criterioUvUt, JsonNode redReferencia,
    JsonNode ayudas, JsonNode tarjetas
) {}
