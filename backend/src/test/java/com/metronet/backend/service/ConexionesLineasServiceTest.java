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
        assertDoesNotThrow(() -> servicio.validarExtension(7, "Azul", "C", "D"));
        assertThrows(ResponseStatusException.class, () -> servicio.validarExtension(7, "Azul", "B", "D"));
        assertThrows(ResponseStatusException.class, () -> servicio.validarExtension(7, "Azul", "C", "A"));
        assertThrows(ResponseStatusException.class, () -> servicio.validarExtension(7, "Roja", "C", "D"));
    }

    @Test void conexionNoModificaTramosYExigeDosLineasConstruidas() {
        red();
        var solicitud = new ConexionLineasRequest("Azul", "C", "Verde", "D");
        servicio.crear(7, solicitud);
        verify(repo).crear(7, solicitud);
        verify(geo).validarRecorrido(7, List.of("C", "D"));
        assertThrows(ResponseStatusException.class, () -> servicio.crear(7, new ConexionLineasRequest("Azul", "A", "Azul", "C")));
        assertThrows(ResponseStatusException.class, () -> servicio.crear(7, new ConexionLineasRequest("Azul", "E", "Verde", "D")));
        assertThrows(ResponseStatusException.class, () -> servicio.crear(7, null));
    }

    @Test void rechazaDuplicadoAunqueInviertanLosExtremos() {
        red();
        when(repo.listar(7)).thenReturn(List.of(new ConexionLineasResponse(1, "Azul", "C", "Verde", "D")));
        var error = assertThrows(ResponseStatusException.class, () -> servicio.crear(7, new ConexionLineasRequest("Verde", "D", "Azul", "C")));
        assertEquals(409, error.getStatusCode().value());
        verify(repo, never()).crear(anyInt(), any());
    }
    @Test void rechazaOtraConexionEntreElMismoParAunqueCambienLasEstaciones() {
        red();
        when(repo.listar(7)).thenReturn(List.of(new ConexionLineasResponse(1, "Azul", "C", "Verde", "D")));
        for (var solicitud : List.of(new ConexionLineasRequest("Azul", "A", "Verde", "E"),
                new ConexionLineasRequest("Verde", "E", "Azul", "B"))) {
            var error = assertThrows(ResponseStatusException.class, () -> servicio.crear(7, solicitud));
            assertEquals(409, error.getStatusCode().value());
            assertEquals("Estas líneas ya tienen una conexión", error.getReason());
        }
        verify(repo, never()).crear(anyInt(), any());
    }

}
