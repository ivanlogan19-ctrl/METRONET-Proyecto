package com.metronet.backend.dto;
import java.math.BigDecimal;
public record ActualizarUnidadMetroRequest(String nombreLinea, Integer capacidad, BigDecimal velocidadPromedio,
 @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = HorasSimuladasDeserializer.class) Double duracionUt,
 String parametroReferencia) {
 public ActualizarUnidadMetroRequest(String linea, Integer capacidad, BigDecimal uv, Number ut) {
  this(linea, capacidad, uv, ut == null ? null : ut.doubleValue(), null);
 }
 public ActualizarUnidadMetroRequest(String linea, Integer capacidad, BigDecimal uv) { this(linea, capacidad, uv, null, null); }
}
