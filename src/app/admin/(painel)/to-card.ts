import type { AppointmentView } from "@/lib/appointments";
import { sql } from "@/lib/db";
import { fmtTime } from "@/lib/time";
import type { CardAppointment } from "./appointment-card";

/** Converte marcações para o formato do cartão, com o nº de visitas de cada cliente */
export async function toCards(list: AppointmentView[]): Promise<CardAppointment[]> {
  const ids = [...new Set(list.map((a) => a.customer_id))];
  const visits = ids.length
    ? await sql<{ customer_id: number; n: number }[]>`
        select customer_id, count(*)::int as n from appointments
        where customer_id = any(${ids}) and status in ('booked', 'completed')
        group by customer_id`
    : [];
  const vmap = new Map(visits.map((v) => [v.customer_id, v.n]));
  const now = Date.now();
  return list.map((a) => ({
    id: a.id,
    time: fmtTime(a.starts_at),
    endTime: fmtTime(a.ends_at),
    past: a.starts_at.getTime() < now,
    status: a.status,
    price_cents: a.price_cents,
    service_name: a.service_name,
    barber_id: a.barber_id,
    barber_name: a.barber_name,
    customer_id: a.customer_id,
    customer_name: a.customer_name,
    phone: a.phone,
    notes: a.notes,
    source: a.source,
    visits: vmap.get(a.customer_id) ?? 0,
  }));
}
