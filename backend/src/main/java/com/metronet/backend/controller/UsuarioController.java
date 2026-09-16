package com.metronet.backend.controller;

import com.metronet.backend.dto.CambioRolRequest;
import com.metronet.backend.dto.ActualizarUsuarioRequest;
import com.metronet.backend.dto.UsuarioResponse;
import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.UsuarioService;
import java.util.List;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/usuarios")
@CrossOrigin(
    origins = {"http://127.0.0.1:5173", "http://localhost:5173"},
    allowedHeaders = "*"
)
public class UsuarioController {
    private final UsuarioService usuarioService;
    private final AuthService authService;

    public UsuarioController(UsuarioService usuarioService, AuthService authService) {
        this.usuarioService = usuarioService;
        this.authService = authService;
    }

    @GetMapping
    public List<UsuarioResponse> obtenerUsuarios(
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        return usuarioService.listarUsuarios();
    }

    @PatchMapping("/{idUsuario}/rol")
    public UsuarioResponse actualizarRol(
        @PathVariable Integer idUsuario,
        @RequestBody CambioRolRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        Usuario administrador = authService.obtenerAdministradorAutorizado(autorizacion);

        if (administrador.getIdUsuario().equals(idUsuario) && solicitud.rol() != Rol.ADMIN) {
            throw new IllegalArgumentException("No podés quitarte tu propio rol de administrador");
        }

        return usuarioService.actualizarRol(idUsuario, solicitud.rol());
    }

    @PatchMapping("/{idUsuario}")
    public UsuarioResponse actualizarUsuario(
        @PathVariable Integer idUsuario,
        @RequestBody ActualizarUsuarioRequest solicitud,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        authService.obtenerAdministradorAutorizado(autorizacion);
        return usuarioService.actualizarUsuario(idUsuario, solicitud);
    }

    @DeleteMapping("/{idUsuario}")
    public void eliminarUsuario(
        @PathVariable Integer idUsuario,
        @RequestHeader(value = "Authorization", required = false) String autorizacion
    ) {
        Usuario administrador = authService.obtenerAdministradorAutorizado(autorizacion);

        if (administrador.getIdUsuario().equals(idUsuario)) {
            throw new IllegalArgumentException("No podés eliminar tu propia cuenta de administrador");
        }

        usuarioService.eliminarUsuario(idUsuario);
    }
}
