import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

type Driver = 'console' | 'smtp';

interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Envío de correo con dos drivers:
 *
 *  - `console` (por defecto): no envía nada, escribe el enlace en el log del
 *    servidor. Sirve para desarrollar sin dar de alta un SMTP.
 *  - `smtp`: nodemailer contra el SMTP que configures. Es el que debes usar en
 *    producción; si no, la verificación de email no protege de nada porque el
 *    enlace nunca llega a su destinatario.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly log = new Logger('MailService');
  private readonly driver: Driver;
  private readonly from: string;
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const raw = (this.config.get<string>('MAIL_DRIVER') ?? 'console').toLowerCase();
    this.driver = raw === 'smtp' ? 'smtp' : 'console';
    this.from = this.config.get<string>('MAIL_FROM') ?? 'Top Note <no-reply@topnote.local>';
  }

  onModuleInit() {
    if (this.driver !== 'smtp') {
      this.log.warn(
        'MAIL_DRIVER=console — los emails NO se envían, se escriben en este log. ' +
        'Configura SMTP antes de exponer la app en internet.',
      );
      return;
    }
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (!host) throw new Error('MAIL_DRIVER=smtp requiere SMTP_HOST');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      // 465 usa TLS implícito; 587 arranca en claro y sube a TLS con STARTTLS.
      secure: this.config.get<string>('SMTP_SECURE') === 'true' || port === 465,
      auth: user ? { user, pass } : undefined,
    });
  }

  async sendVerificationEmail(to: string, name: string, link: string): Promise<void> {
    await this.send({
      to,
      subject: 'Confirma tu email · Top Note',
      text:
        `Hola ${name},\n\n` +
        `Confirma tu dirección de email para activar tu cuenta de Top Note:\n${link}\n\n` +
        `El enlace caduca en 24 horas. Si no has creado ninguna cuenta, ignora este mensaje.`,
      html: this.layout(
        `Hola ${escapeHtml(name)},`,
        'Confirma tu dirección de email para activar tu cuenta de Top Note.',
        link, 'Confirmar email',
        'El enlace caduca en 24 horas. Si no has creado ninguna cuenta, ignora este mensaje.',
      ),
    });
  }

  async sendPasswordResetEmail(to: string, name: string, link: string): Promise<void> {
    await this.send({
      to,
      subject: 'Restablece tu contraseña · Top Note',
      text:
        `Hola ${name},\n\n` +
        `Has pedido restablecer tu contraseña de Top Note:\n${link}\n\n` +
        `El enlace caduca en 1 hora y solo se puede usar una vez. ` +
        `Si no has sido tú, ignora este mensaje: tu contraseña no cambia.`,
      html: this.layout(
        `Hola ${escapeHtml(name)},`,
        'Has pedido restablecer tu contraseña de Top Note.',
        link, 'Restablecer contraseña',
        'El enlace caduca en 1 hora y solo se puede usar una vez. Si no has sido tú, ' +
        'ignora este mensaje: tu contraseña no cambia.',
      ),
    });
  }

  async sendPasswordChangedEmail(to: string, name: string): Promise<void> {
    await this.send({
      to,
      subject: 'Tu contraseña ha cambiado · Top Note',
      text:
        `Hola ${name},\n\nLa contraseña de tu cuenta de Top Note acaba de cambiar y ` +
        `se han cerrado todas las sesiones abiertas.\n\n` +
        `Si no has sido tú, restablece la contraseña ahora mismo.`,
      html: this.layout(
        `Hola ${escapeHtml(name)},`,
        'La contraseña de tu cuenta acaba de cambiar y se han cerrado todas las sesiones abiertas.',
        null, null,
        'Si no has sido tú, restablece la contraseña ahora mismo.',
      ),
    });
  }

  private async send(mail: Mail): Promise<void> {
    if (this.driver === 'console' || !this.transporter) {
      const link = mail.text.match(/https?:\/\/\S+/)?.[0];
      this.log.log(
        `\n──────── EMAIL (driver=console, no enviado) ────────\n` +
        `Para:    ${mail.to}\n` +
        `Asunto:  ${mail.subject}\n` +
        (link ? `Enlace:  ${link}\n` : '') +
        `───────────────────────────────────────────────────`,
      );
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, ...mail });
    } catch (err) {
      // Un SMTP caído no debe tumbar un signup ni delatar si un email existe.
      // Lo registramos y seguimos: el usuario siempre puede pedir el reenvío.
      this.log.error(`No se pudo enviar "${mail.subject}" a ${mail.to}: ${(err as Error).message}`);
    }
  }

  private layout(
    greeting: string, body: string,
    link: string | null, cta: string | null, footer: string,
  ): string {
    const button = link && cta
      ? `<p style="margin:28px 0"><a href="${link}" style="background:#16233d;color:#fff;` +
        `text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;` +
        `display:inline-block">${cta}</a></p>` +
        `<p style="font-size:13px;color:#667">Si el botón no funciona, copia este enlace:<br>` +
        `<span style="color:#16233d;word-break:break-all">${link}</span></p>`
      : '';
    return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;
      margin:0 auto;padding:32px 24px;color:#16233d">
      <h1 style="font-size:22px;margin:0 0 20px">Top <em>Note</em></h1>
      <p>${greeting}</p><p>${body}</p>${button}
      <hr style="border:none;border-top:1px solid #e6e8ef;margin:28px 0">
      <p style="font-size:13px;color:#667">${footer}</p></div>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}
