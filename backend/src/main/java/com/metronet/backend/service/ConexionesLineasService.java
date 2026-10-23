package com.metronet.backend.service;

import com.metronet.backend.dto.ConexionLineasRequest;
import com.metronet.backend.dto.ConexionLineasResponse;
import com.metronet.backend.dto.TramoSimulacionResponse;
import com.metronet.backend.repository.ConexionesLineasRepository;
import java.util.List;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Las conexiones relacionan líneas; nunca modifican el recorrido de sus trenes. */
@Service
public class ConexionesLineasService {
    private final ConexionesLineasRepository repositorio;
    private final RestriccionesGeograficasService geografia;
    public ConexionesLineasService(ConexionesLineasRepository repositorio, RestriccionesGeograficasService geografia) {
        this.repositorio = repositorio; this.geografia = geografia;
    }

    public List<ConexionLineasResponse> listar(int diseno) { return repositorio.listar(diseno); }
    public void copiar(int origen, int destino) { repositorio.copiar(origen, destino); }

    @Transactional
    public ConexionLineasResponse crear(int diseno, ConexionLineasRequest c) {
        if (c == null || vacio(c.lineaA()) || vacio(c.lineaB()) || vacio(c.estacionA()) || vacio(c.estacionB()))
            throw invalida("Elegí dos estaciones de líneas diferentes");
        repositorio.bloquear(diseno);
        var tramos = repositorio.tramos(diseno);
        if (c.estacionA().equals(c.estacionB()) || c.lineaA().equals(c.lineaB()) || !pertenece(tramos, c.lineaA(), c.estacionA()) || !pertenece(tramos, c.lineaB(), c.estacionB()))
            throw invalida("La conexión debe unir estaciones de dos líneas diferentes ya construidas");
        for (var existente : repositorio.listar(diseno)) {
            boolean directa = existente.lineaA().equals(c.lineaA()) && existente.lineaB().equals(c.lineaB());
            boolean inversa = existente.lineaA().equals(c.lineaB()) && existente.lineaB().equals(c.lineaA());
            if (directa || inversa) throw new ResponseStatusException(HttpStatus.CONFLICT, "Estas líneas ya tienen una conexión");
        }
        if (!c.estacionA().equals(c.estacionB())) geografia.validarRecorrido(diseno, List.of(c.estacionA(), c.estacionB()));
        return repositorio.crear(diseno, c);
    }

    public void eliminar(int diseno, long conexion) {
        if (repositorio.eliminar(diseno, conexion) == 0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la conexión solicitada");
    }

    /** Extender exige un extremo y una estación nueva para esa línea; no crea bifurcaciones. */
    public void validarExtension(int diseno, String linea, String origen, String destino) {
        repositorio.bloquear(diseno);
        var tramos = repositorio.tramos(diseno);
        long grado = tramos.stream().filter(t -> extremo(t, linea, origen)).count();
        if (grado != 1 || pertenece(tramos, linea, destino))
            throw invalida("Extendé la línea desde uno de sus extremos hacia una estación que todavía no pertenezca a ella");
    }

    private static boolean pertenece(List<TramoSimulacionResponse> tramos, String linea, String estacion) {
        return tramos.stream().anyMatch(t -> extremo(t, linea, estacion));
    }
    private static boolean extremo(TramoSimulacionResponse t, String linea, String estacion) {
        return Objects.equals(t.nombreLinea(), linea) && (Objects.equals(t.estacionA(), estacion) || Objects.equals(t.estacionB(), estacion));
    }
    private static boolean vacio(String valor) { return valor == null || valor.isBlank(); }
    private static ResponseStatusException invalida(String mensaje) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje); }
}
