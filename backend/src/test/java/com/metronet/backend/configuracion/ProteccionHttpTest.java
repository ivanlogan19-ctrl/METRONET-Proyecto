package com.metronet.backend.configuracion;

import static org.junit.jupiter.api.Assertions.*;
import java.time.Clock;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class ProteccionHttpTest {
    @Test void limitaOrigenRealSinConfiarEnXForwardedFor() throws Exception {
        var filtro = new ProteccionHttp(Clock.systemUTC());
        var ejecutadas = new AtomicInteger();
        for(int i=0;i<31;i++) {
            var req = new MockHttpServletRequest("POST", "/auth/login");
            req.setServletPath("/auth/login"); req.setRemoteAddr("127.0.0.1");
            req.addHeader("X-Forwarded-For", "192.0.2."+i);
            var res = new MockHttpServletResponse();
            filtro.doFilter(req,res,(a,b) -> ejecutadas.incrementAndGet());
            if (i==30) { assertEquals(429,res.getStatus()); assertEquals("60",res.getHeader("Retry-After")); }
        }
        assertEquals(30,ejecutadas.get());
    }
    @Test void rechazaCuerpoGrandeInclusoSinContentLengthYNoCacheaErrores() throws Exception {
        var filtro = new ProteccionHttp();
        var req = new MockHttpServletRequest("POST", "/api/simulaciones") {
            @Override public long getContentLengthLong() { return -1; }
        };
        req.setContent(new byte[65537]);
        var res = new MockHttpServletResponse();
        filtro.doFilter(req,res,(a,b) -> fail("No debe alcanzar el controlador"));
        assertEquals(413,res.getStatus());
        assertEquals("no-store",res.getHeader("Cache-Control"));
        assertEquals("nosniff",res.getHeader("X-Content-Type-Options"));
        assertEquals("DENY",res.getHeader("X-Frame-Options"));
    }
}
