package com.metronet.backend.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import java.io.IOException;

/** Evita que Jackson trunque silenciosamente 1.5 horas a 1 en el campo INTEGER existente. */
public class HorasSimuladasDeserializer extends JsonDeserializer<Integer> {
    @Override public Integer deserialize(JsonParser parser, DeserializationContext contexto) throws IOException {
        if (!parser.hasToken(JsonToken.VALUE_NUMBER_INT)) {
            return (Integer) contexto.handleUnexpectedToken(Integer.class, parser);
        }
        return parser.getIntValue();
    }
}
