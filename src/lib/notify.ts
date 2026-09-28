import "server-only";
import { sql, getSettings } from "./db";
import { euros, fmtDateLong, fmtTime } from "./time";

const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email não configurado] → ${to}: ${subject}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html }),
  });
  if (!res.ok) console.error("Erro a enviar email:", res.status, await res.text());
}

export async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.log(`[sms não configurado] → ${to}: ${body}`);
    return;
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM ?? "", Body: body }),
  });
  if (!res.ok) console.error("Erro a enviar SMS:", res.status, await res.text());
}

type Kind = "confirmation" | "reminder" | "cancellation";

type Details = {
  token: string;
  starts_at: Date;
  price_cents: number;
  customer_name: string;
  phone: string;
  email: string | null;
  service_name: string;
  barber_name: string;
};

async function loadDetails(appointmentId: number) {
  const [a] = await sql<Details[]>`
    select a.token, a.starts_at, a.price_cents, c.name as customer_name, c.phone, c.email,
           s.name as service_name, b.name as barber_name
    from appointments a
    join customers c on c.id = a.customer_id
    join services s on s.id = a.service_id
    join barbers b on b.id = a.barber_id
    where a.id = ${appointmentId}`;
  return a;
}

/** Envia SMS e email (se o cliente deu email). Nunca lança erro — uma falha de envio não pode estragar a marcação. */
export async function notifyAppointment(appointmentId: number, kind: Kind) {
  try {
    const [a, settings] = await Promise.all([loadDetails(appointmentId), getSettings()]);
    if (!a) return;
    const shop = settings.shop_name;
    const when = `${fmtDateLong(a.starts_at)} às ${fmtTime(a.starts_at)}`;
    const link = `${APP_URL}/m/${a.token}`;
    const first = a.customer_name.split(" ")[0];

    const sms = {
      confirmation: `${shop}: marcação confirmada para ${when} (${a.service_name} com ${a.barber_name}). Ver/cancelar: ${link}`,
      reminder: `${shop}: lembrete — amanhã, ${fmtTime(a.starts_at)}, ${a.service_name} com ${a.barber_name}. Não pode vir? Cancele aqui: ${link}`,
      cancellation: `${shop}: a sua marcação de ${when} foi cancelada. Para marcar de novo: ${APP_URL}`,
    }[kind];

    const subject = {
      confirmation: `Marcação confirmada — ${when}`,
      reminder: `Lembrete: amanhã às ${fmtTime(a.starts_at)}`,
      cancellation: `Marcação cancelada — ${when}`,
    }[kind];

    const intro = {
      confirmation: "A sua marcação está confirmada.",
      reminder: "Só para lembrar que tem marcação amanhã.",
      cancellation: "A sua marcação foi cancelada.",
    }[kind];

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#1a1a1a">
        <h2 style="margin:0 0 12px">${shop}</h2>
        <p>Olá ${escapeHtml(first)},</p>
        <p>${intro}</p>
        <table style="border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:4px 12px 4px 0;color:#666">Quando</td><td><b>${when}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Serviço</td><td>${escapeHtml(a.service_name)} · ${euros(a.price_cents)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Barbeiro</td><td>${escapeHtml(a.barber_name)}</td></tr>
          ${settings.address ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Onde</td><td>${escapeHtml(settings.address)}</td></tr>` : ""}
        </table>
        ${
          kind === "cancellation"
            ? `<p><a href="${APP_URL}" style="color:#b8893b">Fazer nova marcação</a></p>`
            : `<p><a href="${link}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Ver ou cancelar marcação</a></p>`
        }
      </div>`;

    await Promise.all([
      sendSms(a.phone, sms),
      a.email ? sendEmail(a.email, subject, html) : Promise.resolve(),
    ]);
  } catch (err) {
    console.error("Falha ao notificar marcação", appointmentId, err);
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
