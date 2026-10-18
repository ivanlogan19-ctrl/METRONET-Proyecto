package com.metronet.backend.service;

import com.metronet.backend.dto.ActividadAdministrativaResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.repository.ActividadAdministrativaRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ActividadAdministrativaService {
    private final ActividadAdministrativaRepository repositorio;

    public ActividadAdministrativaService(ActividadAdministrativaRepository repositorio) {
        this.repositorio = repositorio;
    }

    public void registrarActividad(Usuario administrador, String accion, String detalle) {
        repositorio.registrarActividad(administrador.getIdUsuario(), accion, detalle);
    }

    public List<ActividadAdministrativaResponse> listarActividades() {
        return repositorio.listarActividades((resultado, fila) -> new ActividadAdministrativaResponse(
                resultado.getInt("id_actividad"),
                resultado.getString("administrador"),
                resultado.getString("accion"),
                resultado.getString("detalle"),
                resultado.getTimestamp("fecha").toLocalDateTime()
            ));
    }

    @Transactional
    public boolean borrarActividad(int idActividad) {
        return repositorio.borrarActividad(idActividad) > 0;
    }

    @Transactional
    public int borrarTodasLasActividades() {
        return repositorio.borrarTodasLasActividades();
    }
}
