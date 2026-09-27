package com.metronet.backend.configuracion;

import com.metronet.backend.utilidades.LimiteSolicitudes;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.server.ResponseStatusException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class ProteccionHttp extends OncePerRequestFilter {
    private static final int MAX_CUERPO = 65536;
    private final LimiteSolicitudes limitePublico;
    public ProteccionHttp() { this(Clock.systemUTC()); }
    public ProteccionHttp(Clock reloj) {
        limitePublico = new LimiteSolicitudes(reloj, 30, Duration.ofMinutes(1));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
        response.setHeader("Cache-Control", "no-store");
        if (request.isSecure()) response.setHeader("Strict-Transport-Security", "max-age=31536000");
        String ruta = request.getServletPath();
        boolean escritura = !request.getMethod().equals("GET") && !request.getMethod().equals("OPTIONS") && !request.getMethod().equals("HEAD");
        if (escritura && (ruta.startsWith("/auth/login") || ruta.equals("/auth/registro") || ruta.startsWith("/auth/recuperar-contrasena"))) {
            try { limitePublico.registrar(request.getRemoteAddr()); }
            catch (ResponseStatusException error) {
                response.setHeader("Retry-After", "60");
                rechazar(response, 429, "Demasiadas solicitudes. Esperá un minuto antes de volver a intentar.");
                return;
            }
        }
        if (escritura) {
            if (request.getContentLengthLong() > MAX_CUERPO) {
                rechazar(response, 413, "La solicitud supera el tamaño permitido.");
                return;
            }
            byte[] cuerpo = request.getInputStream().readNBytes(MAX_CUERPO + 1);
            if (cuerpo.length > MAX_CUERPO) {
                rechazar(response, 413, "La solicitud supera el tamaño permitido.");
                return;
            }
            request = new HttpServletRequestWrapper(request) {
                @Override public ServletInputStream getInputStream() {
                    ByteArrayInputStream datos = new ByteArrayInputStream(cuerpo);
                    return new ServletInputStream() {
                        @Override public int read() { return datos.read(); }
                        @Override public boolean isFinished() { return datos.available() == 0; }
                        @Override public boolean isReady() { return true; }
                        @Override public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException("Lectura síncrona"); }
                    };
                }
            };
        }
        chain.doFilter(request, response);
    }

    private void rechazar(HttpServletResponse response, int estado, String mensaje) throws IOException {
        response.setStatus(estado);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"detail\":\"" + mensaje + "\"}");
    }
}
