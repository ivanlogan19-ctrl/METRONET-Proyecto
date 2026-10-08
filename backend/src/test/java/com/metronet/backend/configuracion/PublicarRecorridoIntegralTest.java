package com.metronet.backend.configuracion;

import com.metronet.backend.service.RecorridoIntegralService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class PublicarRecorridoIntegralTest {
    private final ApplicationContextRunner contexto = new ApplicationContextRunner()
        .withUserConfiguration(PublicarRecorridoIntegral.class)
        .withBean(RecorridoIntegralService.class, () -> mock(RecorridoIntegralService.class));

    @Test void arranqueNormalNoPublica() {
        contexto.run(c -> {
            assertThat(c).hasNotFailed().doesNotHaveBean(ApplicationRunner.class);
            verifyNoInteractions(c.getBean(RecorridoIntegralService.class));
        });
    }

    @Test void arranqueExplicitoRegistraUnRunnerSinColisionDeNombre() {
        contexto.withPropertyValues("metronet.recorrido.publicar=true", "metronet.recorrido.administrador=2").run(c -> {
            assertThat(c).hasNotFailed().hasSingleBean(ApplicationRunner.class);
            c.getBean(ApplicationRunner.class).run(new DefaultApplicationArguments());
            verify(c.getBean(RecorridoIntegralService.class)).publicar(2);
        });
    }
}
