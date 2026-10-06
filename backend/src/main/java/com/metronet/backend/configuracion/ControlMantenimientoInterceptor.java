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
        String ruta = solicitud.getRequestURI();
        if ("OPTIONS".equals(solicitud.getMethod()) || "/api/estado".equals(ruta)
            || ruta.startsWith("/api/admin/") || ruta.startsWith("/auth/login/admin")
            || "/auth/logout".equals(ruta)
            || !configuracionService.estaModoMantenimientoActivo()) return true;
        if ("/auth/login".equals(ruta) || "/auth/registro".equals(ruta)) {
            throw mantenimientoActivo();
        }
        String autorizacion = solicitud.getHeader("Authorization");
        if (autorizacion == null || autorizacion.isBlank()) return true;
        Usuario usuario = authService.obtenerUsuarioConSesion(autorizacion);
        if (usuario.getRol() == Rol.JUGADOR) {
            throw mantenimientoActivo();
        }
        return true;
    }

    private ResponseStatusException mantenimientoActivo() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
            "METRONET está en mantenimiento. Disculpá las molestias. Volvé cuando finalice.");
    }
}
