import "server-only";
import { sql, getSettings, type Settings } from "./db";
import { addDaysKey, dayKey, hhmm, timeToMin, weekdayOf, zoned } from "./time";

export type Slot = { time: string; barberIds: number[] };

type Busy = { barber_id: number; starts_at: Date; ends_at: Date };

/**
 * Horários livres para um serviço num dia.
 * barberId = null → qualquer barbeiro (cada horário indica quais estão livres).
 */
export async function getAvailableSlots(opts: {
  serviceId: number;
  barberId: number | null;
  day: string;
  settings?: Settings;
  forAdmin?: boolean;
}): Promise<Slot[]> {
  const settings = opts.settings ?? (await getSettings());
  const [service] = await sql<{ duration_min: number }[]>`
    select duration_min from services where id = ${opts.serviceId} and active`;
  if (!service) return [];

  const today = dayKey();
  if (!opts.forAdmin) {
    if (opts.day < today || opts.day > addDaysKey(today, settings.max_days_ahead)) return [];
  }

  const weekday = weekdayOf(opts.day);
  const dayStart = zoned(opts.day, "00:00");
  const dayEnd = zoned(addDaysKey(opts.day, 1), "00:00");
  const barberFilter = opts.barberId ? sql`and b.id = ${opts.barberId}` : sql``;

  const [hours, busy] = await Promise.all([
    sql<{ barber_id: number; start_time: string; end_time: string }[]>`
      select wh.barber_id, to_char(wh.start_time, 'HH24:MI') as start_time,
             to_char(wh.end_time, 'HH24:MI') as end_time
      from working_hours wh join barbers b on b.id = wh.barber_id
      where b.active and wh.weekday = ${weekday} ${barberFilter}
      order by wh.start_time`,
    sql<Busy[]>`
      select barber_id, starts_at, ends_at from appointments
      where status in ('booked', 'completed') and starts_at < ${dayEnd} and ends_at > ${dayStart}
      union all
      select barber_id, starts_at, ends_at from time_off
      where starts_at < ${dayEnd} and ends_at > ${dayStart}`,
  ]);

  // A gestão pode registar clientes que já foram atendidos (ex.: sem marcação) → sem limite no passado
  const earliest = opts.forAdmin ? 0 : Date.now() + settings.min_notice_minutes * 60_000;
  const step = settings.slot_minutes;
  const duration = service.duration_min * 60_000;
  const slots = new Map<string, number[]>();

  for (const block of hours) {
    const end = timeToMin(block.end_time);
    for (let m = timeToMin(block.start_time); m + service.duration_min <= end; m += step) {
      const time = hhmm(m);
      const start = zoned(opts.day, time).getTime();
      if (start < earliest) continue;
      const finish = start + duration;
      const clash = busy.some(
        (b) =>
          b.barber_id === block.barber_id &&
          b.starts_at.getTime() < finish &&
          b.ends_at.getTime() > start,
      );
      if (clash) continue;
      const list = slots.get(time) ?? [];
      if (!list.includes(block.barber_id)) list.push(block.barber_id);
      slots.set(time, list);
    }
  }

  return [...slots.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, barberIds]) => ({ time, barberIds }));
}

/** Dias (a partir de hoje) em que algum barbeiro trabalha — para o calendário de marcação */
export async function getOpenDays(barberId: number | null, settings: Settings) {
  const barberFilter = barberId ? sql`and b.id = ${barberId}` : sql``;
  const rows = await sql<{ weekday: number; close: string }[]>`
    select wh.weekday, to_char(max(wh.end_time), 'HH24:MI') as close
    from working_hours wh join barbers b on b.id = wh.barber_id
    where b.active ${barberFilter} group by wh.weekday`;
  const closing = new Map(rows.map((r) => [r.weekday, r.close]));
  const today = dayKey();
  const earliest = Date.now() + settings.min_notice_minutes * 60_000;
  const days: string[] = [];
  for (let i = 0; i <= settings.max_days_ahead; i++) {
    const d = addDaysKey(today, i);
    const close = closing.get(weekdayOf(d));
    // Hoje só aparece se ainda houver tempo para marcar antes de fechar
    if (close && zoned(d, close).getTime() > earliest) days.push(d);
  }
  return days;
}
