package com.metronet.backend.service;

import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.AprendizajeRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Consulta de tarjetas desbloqueadas a partir de logros persistidos en cualquier campaña. */
@Service
public class AprendizajeService {
    private final AprendizajeRepository repositorio;
    private final ContenidoPublicadoNivelService contenido;

    public AprendizajeService(AprendizajeRepository repositorio, ContenidoPublicadoNivelService contenido) {
        this.repositorio = repositorio;
        this.contenido = contenido;
    }

    public record Nivel(int numero, boolean desbloqueado, ContenidoPublicadoNivelService.Contenido contenido) {}

    public List<Nivel> niveles(Usuario usuario) {
        Set<Integer> completados = new HashSet<>(repositorio.numerosCompletados((r, fila) -> r.getInt(1), usuario.getIdUsuario()));
        boolean administrador = usuario.getRol() == Rol.ADMIN;
        return java.util.stream.IntStream.rangeClosed(1, 10).mapToObj(numero -> {
            boolean desbloqueado = administrador || completados.contains(numero);
            return new Nivel(numero, desbloqueado, desbloqueado ? contenido.actual(numero) : null);
        }).toList();
    }

    public ContenidoPublicadoNivelService.Contenido contenido(int numero, Usuario usuario) {
        if (numero < 1 || numero > 10) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (usuario.getRol() != Rol.ADMIN && !Boolean.TRUE.equals(repositorio.nivelCompletado(usuario.getIdUsuario(), numero))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Completá el nivel para consultar sus tarjetas");
        }
        return contenido.actual(numero);
    }
}
