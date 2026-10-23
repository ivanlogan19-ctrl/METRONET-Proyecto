package com.metronet.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.metronet.backend.dto.*;
import com.metronet.backend.repository.ConexionesLineasRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class ConexionesLineasServiceTest {
    private final ConexionesLineasRepository repo = mock(ConexionesLineasRepository.class);
    private final RestriccionesGeograficasService geo = mock(RestriccionesGeograficasService.class);
    private final ConexionesLineasService servicio = new ConexionesLineasService(repo, geo);

    private void red() {
        when(repo.tramos(7)).thenReturn(List.of(new TramoSimulacionResponse("Azul", "A", "B"),
            new TramoSimulacionResponse("Azul", "B", "C"), new TramoSimulacionResponse("Verde", "D", "E")));
    }

    @Test void extiendeDesdeExtremoSinCrearOtraLineaNiPermitirRamales() {
        red();
        assertDoesNotThrow(() -> servicio.validarExtension(7, "Azul", "C", "Libre"));
        assertThrows(ResponseStatusException.class, () -> servicio.validarExtension(7, "Azul", "C", "D"));
        assertThrows(ResponseStatusException.class, () -> servicio.validarExtension(7, "Azul", "B", "D"));
        assertThrows(ResponseStatusException.class, () -> servicio.validarExtension(7, "Azul", "C", "A"));
        assertThrows(ResponseStatusException.class, () -> servicio.validarExtension(7, "Roja", "C", "D"));
    }

    @Test void conexionComparteUnaEstacionSinCrearRecorridoPropio() {
        when(repo.tramos(7)).thenReturn(List.of(new TramoSimulacionResponse("Azul", "A", "B"),
            new TramoSimulacionResponse("Verde", "B", "C")));
        var solicitud = new ConexionLineasRequest("Azul", "B", "Verde", "B");
        servicio.crear(7, solicitud);
        verify(repo).crear(7, solicitud);
        verifyNoInteractions(geo);
    }

    @Test void conexionFusionaSinAgregarTramos() {
        red();
        servicio.crear(7, new ConexionLineasRequest("Azul", "C", "Verde", "D"));
        verify(repo).fusionar(7, "Azul", "C", "D");
        verify(repo).crear(7, new ConexionLineasRequest("Azul", "D", "Verde", "D"));
        verify(geo).validarRecorrido(7, List.of("B", "D"));
    }

    @Test void noConectaUnaLineaConsigoMisma() {
        red();

        assertThrows(ResponseStatusException.class, () -> servicio.crear(7, new ConexionLineasRequest("Azul", "A", "Azul", "C")));
        assertThrows(ResponseStatusException.class, () -> servicio.crear(7, null));
        verify(repo, never()).crear(anyInt(), any());
    }

    @Test void fusionaTambienUnaEstacionIntermediaConservandoAmbosTramos() {
        red();
        servicio.crear(7, new ConexionLineasRequest("Azul", "B", "Verde", "D"));
        verify(repo).fusionar(7, "Azul", "B", "D");
        verify(geo).validarRecorrido(7, List.of("A", "D"));
        verify(geo).validarRecorrido(7, List.of("C", "D"));
    }

    @Test void conexionDesdeEstacionLibreCreaUnaLineaDistinta() {
        red();
        servicio.crear(7,new ConexionLineasRequest("Rosa","Libre","Azul","B"));
        verify(repo).crearLinea(7,"Rosa","Libre","B");
        verify(repo).crear(7,new ConexionLineasRequest("Rosa","B","Azul","B"));
        verify(repo,never()).fusionar(anyInt(),anyString(),anyString(),anyString());
    }

    @Test void unaEstacionLibreNoPuedeReutilizarElNombreDeOtraLinea() {
        red();
        when(repo.existeLinea(7,"Verde")).thenReturn(true);
        assertThrows(ResponseStatusException.class,()->servicio.crear(7,new ConexionLineasRequest("Verde","Libre","Azul","B")));
        verify(repo,never()).crearLinea(anyInt(),anyString(),anyString(),anyString());
    }

    @Test void rechazaDuplicadoAunqueInviertanLasLineas() {
        red();
        when(repo.listar(7)).thenReturn(List.of(new ConexionLineasResponse(1, "Azul", "D", "Verde", "D")));
        var error = assertThrows(ResponseStatusException.class, () -> servicio.crear(7, new ConexionLineasRequest("Verde", "E", "Azul", "C")));
        assertEquals(409, error.getStatusCode().value());
        verify(repo, never()).crear(anyInt(), any());
    }
}
