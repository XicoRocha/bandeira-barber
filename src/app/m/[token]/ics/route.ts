import { getAppointmentByToken } from "@/lib/appointments";
import { getSettings } from "@/lib/db";

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export async function GET(_req: Request, ctx: RouteContext<"/m/[token]/ics">) {
  const { token } = await ctx.params;
  const [a, settings] = await Promise.all([getAppointmentByToken(token), getSettings()]);
  if (!a) return new Response("Não encontrado", { status: 404 });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bandeira Barber//Marcacoes//PT",
    "BEGIN:VEVENT",
    `UID:${a.token}@bandeirabarber`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(a.starts_at)}`,
    `DTEND:${icsDate(a.ends_at)}`,
    `SUMMARY:${a.service_name} — ${settings.shop_name}`,
    `DESCRIPTION:Com ${a.barber_name}`,
    settings.address ? `LOCATION:${settings.address.replace(/,/g, "\\,")}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Marcação na barbearia",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="marcacao.ics"`,
    },
  });
}
