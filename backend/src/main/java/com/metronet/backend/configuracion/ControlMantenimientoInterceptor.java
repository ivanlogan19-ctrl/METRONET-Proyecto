package com.metronet.backend.configuracion;

import com.metronet.backend.entity.Usuario;
import com.metronet.backend.enums.Rol;
import com.metronet.backend.service.AuthService;
import com.metronet.backend.service.ConfiguracionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.server.ResponseStatusException;

@Component
public class ControlMantenimientoInterceptor implements HandlerInterceptor {
    private final AuthService authService;
    private final ConfiguracionService configuracionService;

    public ControlMantenimientoInterceptor(AuthService authService, ConfiguracionService configuracionService) {
        this.authService = authService;
        this.configuracionService = configuracionService;
    }

    @Override
    public boolean preHandle(HttpServletRequest solicitud, HttpServletResponse respuesta, Object controlador) {
        if (!esOperacionModificable(solicitud) || !configuracionService.estaModoMantenimientoActivo()) return true;
        Usuario usuario = authService.obtenerUsuarioConSesion(solicitud.getHeader("Authorization"));
        if (usuario.getRol() == Rol.JUGADOR) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "La plataforma está en mantenimiento. Por el momento no podés crear ni modificar diseños o simulaciones."
            );
        }
        return true;
    }

    private boolean esOperacionModificable(HttpServletRequest solicitud) {
        String metodo = solicitud.getMethod();
        return !"GET".equals(metodo) && !"HEAD".equals(metodo) && !"OPTIONS".equals(metodo);
    }
}
