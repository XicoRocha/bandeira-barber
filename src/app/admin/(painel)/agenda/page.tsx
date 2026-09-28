import Link from "next/link";
import { getAppointmentsBetween } from "@/lib/appointments";
import { getBarbers, getServices, sql } from "@/lib/db";
import {
  addDaysKey,
  dayKey,
  euros,
  fmt,
  hhmm,
  isDayKey,
  minutesOfDay,
  timeToMin,
  weekdayOf,
  zoned,
} from "@/lib/time";
import { PageTitle } from "@/components/ui";
import { AppointmentCard } from "../appointment-card";
import { toCards } from "../to-card";
import { AgendaTools, DatePicker, RemoveTimeOff } from "./agenda-tools";

type Item =
  | { kind: "appt"; start: number; id: number }
  | { kind: "off"; start: number; end: number; id: number; reason: string; allDay: boolean }
  | { kind: "free"; start: number; end: number };

export default async function AgendaPage(props: PageProps<"/admin/agenda">) {
  const sp = await props.searchParams;
  const today = dayKey();
  const day = isDayKey(sp.d) ? sp.d : today;
  const next = addDaysKey(day, 1);
  const from = zoned(day);
  const to = zoned(next);
  const weekday = weekdayOf(day);

  // Faixa de 7 dias à volta do dia escolhido, com nº de marcações
  const stripStart = addDaysKey(day, -3);
  const stripEnd = addDaysKey(day, 4);

  const [barbers, services, appointments, timeOff, hours, counts] = await Promise.all([
    getBarbers(),
    getServices(),
    getAppointmentsBetween(from, to),
    sql<{ id: number; barber_id: number; starts_at: Date; ends_at: Date; reason: string }[]>`
      select * from time_off where starts_at < ${to} and ends_at > ${from} order by starts_at`,
    sql<{ barber_id: number; start_time: string; end_time: string }[]>`
      select barber_id, to_char(start_time, 'HH24:MI') as start_time, to_char(end_time, 'HH24:MI') as end_time
      from working_hours where weekday = ${weekday} order by start_time`,
    sql<{ day: string; n: number }[]>`
      select to_char(starts_at at time zone 'Europe/Lisbon', 'YYYY-MM-DD') as day, count(*)::int as n
      from appointments
      where status in ('booked','completed') and starts_at >= ${zoned(stripStart)} and starts_at < ${zoned(stripEnd)}
      group by 1`,
  ]);

  const cards = await toCards(appointments);
  const countMap = new Map(counts.map((c) => [c.day, c.n]));
  const active = appointments.filter((a) => a.status === "booked" || a.status === "completed");
  const revenue = active.reduce((s, a) => s + a.price_cents, 0);

  function itemsFor(barberId: number): Item[] {
    const appts = appointments.filter((a) => a.barber_id === barberId);
    const offs = timeOff.filter((t) => t.barber_id === barberId);
    const items: Item[] = [
      ...appts.map((a) => ({ kind: "appt" as const, start: minutesOfDay(a.starts_at), id: a.id })),
      ...offs.map((t) => {
        const start = t.starts_at < from ? 0 : minutesOfDay(t.starts_at);
        const end = t.ends_at >= to ? 24 * 60 : minutesOfDay(t.ends_at);
        return { kind: "off" as const, start, end, id: t.id, reason: t.reason, allDay: start === 0 && end === 1440 };
      }),
    ];

    // Buracos livres dentro do horário de trabalho
    const busy = [
      ...appts
        .filter((a) => a.status === "booked" || a.status === "completed")
        .map((a) => [minutesOfDay(a.starts_at), minutesOfDay(a.ends_at)]),
      ...items.filter((i) => i.kind === "off").map((i) => [i.start, (i as { end: number }).end]),
    ].sort((a, b) => a[0] - b[0]);
    for (const block of hours.filter((h) => h.barber_id === barberId)) {
      let cursor = timeToMin(block.start_time);
      const end = timeToMin(block.end_time);
      for (const [s, e] of busy) {
        if (e <= cursor || s >= end) continue;
        if (s - cursor >= 15) items.push({ kind: "free", start: cursor, end: s });
        cursor = Math.max(cursor, e);
      }
      if (end - cursor >= 15) items.push({ kind: "free", start: cursor, end });
    }
    return items.sort((a, b) => a.start - b.start || (a.kind === "appt" ? -1 : 1));
  }

  return (
    <>
      <PageTitle actions={<DatePicker day={day} />}>
        <span className="first-letter:uppercase">{fmt(zoned(day, "12:00"), "EEEE, d MMM")}</span>
      </PageTitle>

      <div className="mb-5 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => addDaysKey(stripStart, i)).map((d) => {
          const date = zoned(d, "12:00");
          const n = countMap.get(d) ?? 0;
          return (
            <Link
              key={d}
              href={`/admin/agenda?d=${d}`}
              title={`${n} marcações`}
              className={`flex flex-col items-center rounded-xl border py-2 text-center transition-colors ${
                d === day ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface hover:border-accent"
              }`}
            >
              <span className={`text-[11px] uppercase ${d === day ? "" : "text-muted"}`}>
                {fmt(date, "EEE").replace(".", "")}
              </span>
              <span className={`text-lg font-semibold ${d === today && d !== day ? "text-accent" : ""}`}>
                {fmt(date, "d")}
              </span>
              <span className={`text-[11px] ${d === day ? "" : "text-muted"}`}>{n || "—"}</span>
            </Link>
          );
        })}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {active.length} marcações · {euros(revenue)} previstos
        </p>
        <AgendaTools
          day={day}
          services={services.map((s) => ({ id: s.id, name: s.name, duration_min: s.duration_min }))}
          barbers={barbers.map((b) => ({ id: b.id, name: b.name }))}
        />
      </div>

      <div className={`grid gap-6 ${barbers.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {barbers.map((b) => {
          const items = itemsFor(b.id);
          const works = hours.some((h) => h.barber_id === b.id);
          return (
            <section key={b.id}>
              {barbers.length > 1 && <h2 className="display mb-3 text-lg">{b.name}</h2>}
              {!works && !items.length && <p className="card p-5 text-center text-muted">Folga</p>}
              <div className="space-y-2">
                {items.map((item) => {
                  if (item.kind === "appt") {
                    const c = cards.find((c) => c.id === item.id)!;
                    return <AppointmentCard key={`a${item.id}`} a={c} />;
                  }
                  if (item.kind === "off") {
                    return (
                      <div
                        key={`o${item.id}`}
                        className="flex items-center justify-between rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted"
                      >
                        <span>
                          🚫 {item.allDay ? "Dia bloqueado" : `${hhmm(item.start)}–${hhmm(item.end)}`}
                          {item.reason && ` · ${item.reason}`}
                        </span>
                        <RemoveTimeOff id={item.id} />
                      </div>
                    );
                  }
                  return (
                    <div key={`f${item.start}`} className="px-4 text-xs text-ok/80">
                      livre {hhmm(item.start)}–{hhmm(item.end)} ({item.end - item.start} min)
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {day < today && active.some((a) => a.status === "booked") && (
        <p className="mt-6 text-xs text-muted">
          As marcações passadas contam como feitas. Se alguém faltou, use “Opções → Faltou” para as
          estatísticas ficarem certas.
        </p>
      )}
    </>
  );
}
