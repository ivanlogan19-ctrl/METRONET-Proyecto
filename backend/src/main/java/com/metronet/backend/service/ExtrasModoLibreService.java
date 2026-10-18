package com.metronet.backend.service;

import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.repository.ExtrasModoLibreRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Progreso por cuenta, independiente de campañas y de diseños eliminados. */
@Service
public class ExtrasModoLibreService {
    private final ExtrasModoLibreRepository repositorio;
    public ExtrasModoLibreService(ExtrasModoLibreRepository repositorio) { this.repositorio = repositorio; }
    public record Estado(boolean desbloqueado, boolean bienvenidaVista, List<Integer> visitadas,
                         boolean premioObtenido, TrofeosService.Trofeo nuevoTrofeo) {}

    public Estado consultar(Usuario usuario) {
        var filas = repositorio.estadoUsuario((r, n) -> new boolean[]{r.getBoolean(1), r.getBoolean(2)}, usuario.getIdUsuario());
        if (filas.isEmpty()) return new Estado(false, false, List.of(), false, null);
        return new Estado(true, filas.getFirst()[0], repositorio.tarjetasVisitadas(usuario.getIdUsuario()),
            usuario.getRol() != Rol.ADMIN && filas.getFirst()[1], null);
    }

    @Transactional
    public Estado ingresar(Usuario usuario) {
        Estado previo = consultar(usuario);
        if (previo.desbloqueado()) return previo;
        boolean permitido = usuario.getRol() == Rol.ADMIN || Boolean.TRUE.equals(repositorio.campanaCompletada(usuario.getIdUsuario()));
        boolean redLibre = Boolean.TRUE.equals(repositorio.tieneIntentoLibre(usuario.getIdUsuario()));
        if (!permitido || !redLibre) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ingresá a Modo Libre para desbloquear Extras");
        repositorio.registrarIngreso(usuario.getIdUsuario());
        return consultar(usuario);
    }

    @Transactional
    public Estado bienvenida(Usuario usuario) {
        bloquear(usuario);
        repositorio.registrarBienvenida(usuario.getIdUsuario());
        return consultar(usuario);
    }

    @Transactional
    public Estado visitar(Usuario usuario, int tarjeta) {
        if (tarjeta < 1 || tarjeta > 7) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        bloquear(usuario); // Serializa visitas concurrentes y la entrega del premio.
        repositorio.registrarVisita(usuario.getIdUsuario(), tarjeta);
        boolean nuevo = usuario.getRol() != Rol.ADMIN && repositorio.otorgarPremioCompleto(usuario.getIdUsuario(), usuario.getIdUsuario()) == 1;
        Estado estado = consultar(usuario);
        return new Estado(estado.desbloqueado(), estado.bienvenidaVista(), estado.visitadas(), estado.premioObtenido(),
            nuevo ? TrofeosService.trofeoExtras(true) : null);
    }

    private void bloquear(Usuario usuario) {
        var filas = repositorio.bloquearUsuario(usuario.getIdUsuario());
        if (filas.isEmpty()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Extras todavía bloqueados");
    }
}
