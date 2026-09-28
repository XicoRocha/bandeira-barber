import { sql } from "@/lib/db";
import { notifyAppointment } from "@/lib/notify";
import { addDaysKey, dayKey, zoned } from "@/lib/time";

// Chamado 1x por dia pelo cron da Vercel (ver vercel.json). Envia lembrete a quem tem marcação amanhã.
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Não autorizado", { status: 401 });
  }
  const tomorrow = addDaysKey(dayKey(), 1);
  const from = zoned(tomorrow, "00:00");
  const to = zoned(addDaysKey(tomorrow, 1), "00:00");

  // Marca como enviado antes de enviar, para nunca mandar duas vezes o mesmo lembrete
  const due = await sql<{ id: number }[]>`
    update appointments set reminder_sent_at = now()
    where status = 'booked' and reminder_sent_at is null
      and starts_at >= ${from} and starts_at < ${to}
    returning id`;

  for (const a of due) await notifyAppointment(a.id, "reminder");
  return Response.json({ sent: due.length });
}
