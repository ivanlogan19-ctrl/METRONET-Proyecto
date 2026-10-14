package com.metronet.backend.dto;
import java.math.BigDecimal;
/** El Service permite UT fraccionarias únicamente en Modo Libre. */
public record EjecutarSimulacionRequest(BigDecimal velocidad,
 @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = HorasSimuladasDeserializer.class) Double duracion) {
 public EjecutarSimulacionRequest(BigDecimal velocidad, Number duracion) {
  this(velocidad, duracion == null ? null : duracion.doubleValue());
 }
}
