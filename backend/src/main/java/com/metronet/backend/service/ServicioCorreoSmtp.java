package com.metronet.backend.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class ServicioCorreoSmtp implements ServicioCorreo {
    private static final Logger REGISTRO = LoggerFactory.getLogger(ServicioCorreoSmtp.class);
    private static final String CONTENIDO_LOGO = "logoMetronet";
    private static final String RUTA_LOGO = "assets/logoMETRONET-transparente.png";
    private final ObjectProvider<JavaMailSender> proveedorCorreo;
    private final boolean correoHabilitado;
    private final String servidorCorreo;
    private final String remitente;

    public ServicioCorreoSmtp(
        ObjectProvider<JavaMailSender> proveedorCorreo,
        @Value("${metronet.correo.habilitado:false}") boolean correoHabilitado,
        @Value("${spring.mail.host:}") String servidorCorreo,
        @Value("${metronet.correo.remitente:}") String remitente
    ) {
        this.proveedorCorreo = proveedorCorreo;
        this.correoHabilitado = correoHabilitado;
        this.servidorCorreo = servidorCorreo;
        this.remitente = remitente;
    }

    @Override
    public boolean estaDisponible() {
        return correoHabilitado
            && !servidorCorreo.isBlank()
            && !remitente.isBlank()
            && proveedorCorreo.getIfAvailable() != null;
    }

    @Override
    public void enviarCodigoRecuperacion(String destinatario, String codigo) {
        if (!estaDisponible()) {
            throw new ErrorEnvioCorreoException("El servicio de correo no está configurado");
        }

        try {
            proveedorCorreo.getObject().send(crearMensajeRecuperacion(destinatario, codigo));
        } catch (MailException | MessagingException excepcion) {
            String tipoFalla = obtenerTipoFalla(excepcion);
            REGISTRO.warn("No se pudo enviar el correo de recuperación: {}", tipoFalla);
            throw new ErrorEnvioCorreoException("No fue posible enviar el correo de recuperación", excepcion);
        }
    }

    private MimeMessage crearMensajeRecuperacion(String destinatario, String codigo) throws MessagingException {
        MimeMessage mensaje = proveedorCorreo.getObject().createMimeMessage();
        MimeMessageHelper ayudaMensaje = new MimeMessageHelper(mensaje, true, StandardCharsets.UTF_8.name());
        ayudaMensaje.setFrom(remitente);
        ayudaMensaje.setTo(destinatario);
        ayudaMensaje.setSubject("METRONET · Código de recuperación");
        ayudaMensaje.setText(crearContenidoHtml(codigo), true);
        ayudaMensaje.addInline(CONTENIDO_LOGO, new ClassPathResource(RUTA_LOGO), MediaType.IMAGE_PNG_VALUE);
        return mensaje;
    }

    private String crearContenidoHtml(String codigo) {
        return """
            <!DOCTYPE html>
            <html lang="es">
              <body style="margin:0;padding:0;background:#0b0d0e;color:#e3e6e5;font-family:Arial,Helvetica,sans-serif;">
                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="background:#0b0d0e;padding:32px 16px;">
                  <tr>
                    <td align="center">
                      <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#181d20;border:1px solid #3c454a;border-radius:12px;overflow:hidden;">
                        <tr>
                          <td align="center" style="padding:28px 32px 18px;background:#121619;">
                            <img src="cid:%s" width="184" alt="METRONET" style="display:block;width:184px;max-width:100%%;height:auto;border:0;" />
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:30px 32px 20px;">
                            <p style="margin:0 0 8px;color:#9aa2a6;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Seguridad de tu cuenta</p>
                            <h1 style="margin:0;color:#e3e6e5;font-size:26px;line-height:1.25;">Recuperación de contraseña</h1>
                            <p style="margin:20px 0 0;color:#e3e6e5;font-size:16px;line-height:1.55;">Recibimos una solicitud para recuperar el acceso a tu cuenta de METRONET.</p>
                            <p style="margin:20px 0 10px;color:#9aa2a6;font-size:14px;line-height:1.5;">Ingresá este código en la plataforma:</p>
                            <div style="margin:0 0 20px;padding:18px;background:#20262a;border:1px solid #778187;border-radius:8px;color:#e3e6e5;font-family:monospace;font-size:30px;font-weight:700;letter-spacing:8px;text-align:center;">%s</div>
                            <p style="margin:0;color:#d6a84b;font-size:14px;font-weight:700;line-height:1.5;">El código vence en 10 minutos.</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:20px 32px 28px;border-top:1px solid #3c454a;">
                            <p style="margin:0;color:#9aa2a6;font-size:13px;line-height:1.5;">Si no solicitaste este cambio, podés ignorar este correo. Tu contraseña no se modificará sin ingresar el código.</p>
                            <p style="margin:18px 0 0;color:#778187;font-size:12px;line-height:1.4;text-align:center;">METRONET · Diseña · Simula · Conecta</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """.formatted(CONTENIDO_LOGO, codigo);
    }

    private String obtenerTipoFalla(Exception excepcion) {
        if (excepcion instanceof MailException errorCorreo) {
            Throwable causa = errorCorreo.getMostSpecificCause();
            return causa == null ? errorCorreo.getClass().getSimpleName() : causa.getClass().getSimpleName();
        }
        return excepcion.getClass().getSimpleName();
    }
}
