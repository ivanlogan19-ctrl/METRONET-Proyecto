package com.metronet.backend.service;
import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
class VinculoUvUtLibreTest {
 @Test void distanciaVelocidadYDuracionSeRelacionanSinRedondearAntesDeLlegar() {
  assertEquals(3d, VinculoUvUtLibre.calcular(12,new BigDecimal("4"),null,"UV").ut());
  assertEquals(1.5d, VinculoUvUtLibre.calcular(12,new BigDecimal("8"),null,"UV").ut());
  assertEquals(0, new BigDecimal("8").compareTo(VinculoUvUtLibre.calcular(12,BigDecimal.ONE,1.5,"UT").uv()));
  var fraccion = VinculoUvUtLibre.calcular(1, new BigDecimal("3"),null,"UV");
  assertTrue(fraccion.ut()*3 >= 1);
  var inversa = VinculoUvUtLibre.calcular(1, BigDecimal.ONE,3d,"UT");
  assertTrue(inversa.uv().multiply(new BigDecimal("3")).compareTo(BigDecimal.ONE)>=0);
  assertNull(VinculoUvUtLibre.calcular(0,BigDecimal.ONE,2d,"UT").ut());
 }
 @Test void tiemposFraccionariosSoloEnModoLibre() {
  var solicitud = new com.metronet.backend.dto.EjecutarSimulacionRequest(BigDecimal.ONE,1.5);
  assertThrows(org.springframework.web.server.ResponseStatusException.class,()->ParametrosSimulacion.validar(solicitud,false,false));
  assertDoesNotThrow(()->ParametrosSimulacion.validar(solicitud,false,true));
  assertThrows(org.springframework.web.server.ResponseStatusException.class,()->VinculoUvUtLibre.calcular(12,BigDecimal.ONE,0d,"UT"));
 }
}
