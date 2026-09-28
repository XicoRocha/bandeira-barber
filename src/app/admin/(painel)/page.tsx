import Link from "next/link";
import { getAppointmentsBetween } from "@/lib/appointments";
import { requireStaff } from "@/lib/auth";
import { getBarbers, sql } from "@/lib/db";
import { getKpis } from "@/lib/stats";
import { addDaysKey, dayKey, euros, fmt, fmtDateLong, fmtTime, weekdayOf, zoned, nowMs } from "@/lib/time";
import { Delta, Kpi } from "@/components/ui";
import { AppointmentCard } from "./appointment-card";
import { toCards } from "./to-card";

export default async function HojePage() {
  const user = await requireStaff();
  const today = dayKey();
  const tomorrow = addDaysKey(today, 1);

  // Semana começa à segunda
  const weekStart = addDaysKey(today, -((weekdayOf(today) + 6) % 7));
  const monthStart = today.slice(0, 8) + "01";
  const prevMonthStart = dayKey(new Date(zoned(monthStart).getTime() - 86_400_000)).slice(0, 8) + "01";
  // Mesmo nº de dias no mês anterior, para comparar de forma justa
  const daysIntoMonth = Number(today.slice(8, 10));
  const prevMonthSameDay = addDaysKey(prevMonthStart, daysIntoMonth);

  const [appointments, barbers, week, month, prevMonth, recent] = await Promise.all([
    getAppointmentsBetween(zoned(today), zoned(tomorrow)),
    getBarbers(),
    getKpis({ from: weekStart, to: tomorrow }),
    getKpis({ from: monthStart, to: tomorrow }),
    getKpis({ from: prevMonthStart, to: prevMonthSameDay }),
    sql<
      {
        id: number;
        starts_at: Date;
        created_at: Date;
        customer_name: string;
        service_name: string;
        barber_name: string;
        status: string;
      }[]
    >`
      select a.id, a.starts_at, a.created_at, c.name as customer_name, s.name as service_name,
             b.name as barber_name, a.status
      from appointments a join customers c on c.id = a.customer_id
      join services s on s.id = a.service_id join barbers b on b.id = a.barber_id
      where a.source = 'online' and a.created_at > now() - interval '3 days'
      order by a.created_at desc limit 6`,
  ]);

  const active = appointments.filter((a) => a.status === "booked" || a.status === "completed");
  const now = nowMs();
  const done = active.filter((a) => a.starts_at.getTime() < now);
  const next = active.find((a) => a.starts_at.getTime() >= now);
  const expected = active.reduce((s, a) => s + a.price_cents, 0);
  const cards = await toCards(appointments);

  // Barbeiro vê a sua coluna primeiro
  const ordered = [...barbers].sort(
    (a, b) => Number(b.id === user.barber_id) - Number(a.id === user.barber_id),
  );

  return (
    <>
      <div className="mb-5">
        <p className="text-sm text-muted first-letter:uppercase">{fmtDateLong(new Date())}</p>
        <h1 className="display text-2xl">Olá, {user.name.split(" ")[0]}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Clientes hoje"
          value={String(active.length)}
          hint={`${done.length} feitos · ${active.length - done.length} por fazer`}
        />
        <Kpi label="Faturação hoje" value={euros(expected)} hint="previsto com as marcações" />
        <Kpi label="Esta semana" value={euros(week.revenue)} hint={`${week.done} cortes`} />
        <Kpi
          label="Este mês"
          value={euros(month.revenue)}
          hint={
            <>
              <Delta now={month.revenue} before={prevMonth.revenue} /> vs. mês passado
            </>
          }
        />
      </div>

      {next && (
        <div className="card mt-4 flex items-center gap-4 border-accent/40 bg-accent/5 p-4">
          <div className="text-3xl font-semibold text-accent tabular-nums">{fmtTime(next.starts_at)}</div>
          <div className="min-w-0">
            <div className="text-xs text-muted">A seguir</div>
            <div className="truncate font-medium">
              {next.customer_name} — {next.service_name}
            </div>
            <div className="text-sm text-muted">
              com {next.barber_name} · {relative(next.starts_at.getTime() - now)}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="display text-lg">Agenda de hoje</h2>
            <Link href="/admin/agenda" className="text-sm text-accent hover:underline">
              Ver agenda / nova marcação →
            </Link>
          </div>
          {appointments.length === 0 && (
            <p className="card p-6 text-center text-muted">Sem marcações hoje.</p>
          )}
          <div className={`grid gap-6 ${barbers.length > 1 ? "xl:grid-cols-2" : ""}`}>
            {ordered.map((b) => {
              const list = cards.filter((c) => c.barber_id === b.id);
              if (!list.length) return null;
              return (
                <div key={b.id}>
                  {barbers.length > 1 && (
                    <h3 className="mb-2 text-sm font-medium text-muted">
                      {b.name} · {list.filter((c) => c.status !== "cancelled").length}
                    </h3>
                  )}
                  <div className="space-y-2">
                    {list.map((c) => (
                      <AppointmentCard key={c.id} a={c} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside>
          <h2 className="display mb-3 text-lg">Novas marcações online</h2>
          <div className="card divide-y divide-line">
            {recent.length === 0 && <p className="p-4 text-sm text-muted">Nada nos últimos 3 dias.</p>}
            {recent.map((r) => (
              <div key={r.id} className="p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate font-medium">{r.customer_name}</span>
                  <span className="shrink-0 text-xs text-muted">{relative(r.created_at.getTime() - now)}</span>
                </div>
                <div className={`text-muted ${r.status === "cancelled" ? "line-through" : ""}`}>
                  {fmt(r.starts_at, "EEE d MMM, HH:mm")} · {r.service_name}
                  {barbers.length > 1 && <> · {r.barber_name}</>}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}

function relative(ms: number) {
  const abs = Math.abs(ms);
  const min = Math.round(abs / 60_000);
  const text = min < 60 ? `${min} min` : min < 1440 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} d`;
  return ms >= 0 ? `daqui a ${text}` : `há ${text}`;
}
