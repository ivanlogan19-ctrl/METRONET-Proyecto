package com.metronet.backend.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import java.io.IOException;

/** Acepta números JSON sin truncarlos; el Service valida la escala según el modo. */
public class HorasSimuladasDeserializer extends JsonDeserializer<Double> {
    @Override public Double deserialize(JsonParser parser, DeserializationContext contexto) throws IOException {
        if (!parser.hasToken(JsonToken.VALUE_NUMBER_INT) && !parser.hasToken(JsonToken.VALUE_NUMBER_FLOAT)) {
            return (Double) contexto.handleUnexpectedToken(Double.class, parser);
        }
        return parser.getDoubleValue();
    }
}
