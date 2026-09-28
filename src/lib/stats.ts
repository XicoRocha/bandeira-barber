import "server-only";
import { sql } from "./db";
import { addDaysKey, dayKey, timeToMin, weekdayOf, zoned } from "./time";

// "Realizada" = marcação que já passou e não foi cancelada nem marcada como falta
const DONE = sql`a.status in ('booked', 'completed') and a.starts_at < now()`;

export type Period = { from: string; to: string }; // dias (inclusive → exclusive)

export function periodFromDays(days: number): Period {
  const to = addDaysKey(dayKey(), 1);
  return { from: addDaysKey(to, -days), to };
}

function range(p: Period, barberId: number | null) {
  return sql`a.starts_at >= ${zoned(p.from)} and a.starts_at < ${zoned(p.to)}
    ${barberId ? sql`and a.barber_id = ${barberId}` : sql``}`;
}

export async function getKpis(p: Period, barberId: number | null = null) {
  const [row] = await sql<
    {
      revenue: number;
      done: number;
      no_show: number;
      cancelled: number;
      total: number;
      online: number;
      customers: number;
      new_customers: number;
      booked_minutes: number;
    }[]
  >`
    select
      coalesce(sum(a.price_cents) filter (where ${DONE}), 0)::int as revenue,
      count(*) filter (where ${DONE})::int as done,
      count(*) filter (where a.status = 'no_show')::int as no_show,
      count(*) filter (where a.status = 'cancelled')::int as cancelled,
      count(*)::int as total,
      count(*) filter (where a.source = 'online' and a.status <> 'cancelled')::int as online,
      count(distinct a.customer_id) filter (where ${DONE})::int as customers,
      count(distinct a.customer_id) filter (
        where ${DONE} and not exists (
          select 1 from appointments p
          where p.customer_id = a.customer_id and p.starts_at < ${zoned(p.from)}
            and p.status in ('booked', 'completed')
        )
      )::int as new_customers,
      coalesce(sum(extract(epoch from a.ends_at - a.starts_at) / 60) filter (where ${DONE}), 0)::int
        as booked_minutes
    from appointments a
    where ${range(p, barberId)}`;

  const openMinutes = await getOpenMinutes(p, barberId);
  return {
    ...row,
    avgTicket: row.done ? Math.round(row.revenue / row.done) : 0,
    noShowRate: row.total ? row.no_show / row.total : 0,
    cancelRate: row.total ? row.cancelled / row.total : 0,
    occupancy: openMinutes ? Math.min(1, row.booked_minutes / openMinutes) : 0,
    returningCustomers: row.customers - row.new_customers,
  };
}

/** Minutos de trabalho disponíveis no período (só até agora), para a taxa de ocupação */
async function getOpenMinutes(p: Period, barberId: number | null) {
  const hours = await sql<{ barber_id: number; weekday: number; start_time: string; end_time: string }[]>`
    select wh.barber_id, wh.weekday, to_char(wh.start_time, 'HH24:MI') as start_time,
           to_char(wh.end_time, 'HH24:MI') as end_time
    from working_hours wh join barbers b on b.id = wh.barber_id
    where b.active ${barberId ? sql`and b.id = ${barberId}` : sql``}`;
  const [{ off }] = await sql<{ off: number }[]>`
    select coalesce(sum(extract(epoch from least(ends_at, now(), ${zoned(p.to)})
                                        - greatest(starts_at, ${zoned(p.from)})) / 60), 0)::int as off
    from time_off
    where starts_at < least(now(), ${zoned(p.to)}) and ends_at > ${zoned(p.from)}
      ${barberId ? sql`and barber_id = ${barberId}` : sql``}`;

  const now = Date.now();
  let total = 0;
  for (let d = p.from; d < p.to; d = addDaysKey(d, 1)) {
    const wd = weekdayOf(d);
    for (const h of hours) {
      if (h.weekday !== wd) continue;
      const start = zoned(d, h.start_time).getTime();
      const end = Math.min(zoned(d, h.end_time).getTime(), now);
      if (end > start) total += (end - start) / 60_000;
    }
  }
  return Math.max(0, total - off);
}

export async function getRevenueByDay(p: Period, barberId: number | null = null) {
  const rows = await sql<{ day: string; revenue: number; count: number }[]>`
    select to_char(a.starts_at at time zone 'Europe/Lisbon', 'YYYY-MM-DD') as day,
           sum(a.price_cents)::int as revenue, count(*)::int as count
    from appointments a
    where ${DONE} and ${range(p, barberId)}
    group by 1`;
  const map = new Map(rows.map((r) => [r.day, r]));
  const out: { day: string; revenue: number; count: number }[] = [];
  for (let d = p.from; d < p.to; d = addDaysKey(d, 1)) {
    out.push(map.get(d) ?? { day: d, revenue: 0, count: 0 });
  }
  return out;
}

export async function getByService(p: Period, barberId: number | null = null) {
  return sql<{ name: string; count: number; revenue: number }[]>`
    select s.name, count(*)::int as count, sum(a.price_cents)::int as revenue
    from appointments a join services s on s.id = a.service_id
    where ${DONE} and ${range(p, barberId)}
    group by s.name order by revenue desc`;
}

export async function getByBarber(p: Period) {
  return sql<{ id: number; name: string; count: number; revenue: number; no_show: number }[]>`
    select b.id, b.name,
           count(*) filter (where ${DONE})::int as count,
           coalesce(sum(a.price_cents) filter (where ${DONE}), 0)::int as revenue,
           count(*) filter (where a.status = 'no_show')::int as no_show
    from barbers b left join appointments a on a.barber_id = b.id and ${range(p, null)}
    where b.active
    group by b.id, b.name order by b.id`;
}

/** Procura por dia da semana × hora (conta marcações, incluindo futuras, sem canceladas) */
export async function getHeatmap(p: Period, barberId: number | null = null) {
  return sql<{ weekday: number; hour: number; count: number }[]>`
    select extract(dow from a.starts_at at time zone 'Europe/Lisbon')::int as weekday,
           extract(hour from a.starts_at at time zone 'Europe/Lisbon')::int as hour,
           count(*)::int as count
    from appointments a
    where a.status in ('booked', 'completed') and ${range(p, barberId)}
    group by 1, 2`;
}

/** Clientes que costumavam vir e não aparecem há X dias (e não têm marcação futura) */
export async function getLapsedCustomers(days = 45, limit = 20) {
  return sql<{ id: number; name: string; phone: string; last_visit: Date; visits: number }[]>`
    select c.id, c.name, c.phone, max(a.starts_at) as last_visit, count(*)::int as visits
    from customers c join appointments a on a.customer_id = c.id
    where a.status in ('booked', 'completed')
    group by c.id
    having max(a.starts_at) < now() - make_interval(days => ${days}) and count(*) >= 2
    order by max(a.starts_at) desc
    limit ${limit}`;
}

export function hourRange(hours: { start_time: string; end_time: string }[]) {
  if (!hours.length) return { min: 9, max: 20 };
  return {
    min: Math.floor(Math.min(...hours.map((h) => timeToMin(h.start_time))) / 60),
    max: Math.ceil(Math.max(...hours.map((h) => timeToMin(h.end_time))) / 60),
  };
}
