import Link from "next/link";
import { getBarbers, getServices, getSettings, sql } from "@/lib/db";
import { euros, WEEKDAYS } from "@/lib/time";

export default async function Home() {
  const [settings, services, barbers, hours] = await Promise.all([
    getSettings(),
    getServices(),
    getBarbers(),
    sql<{ weekday: number; open: string; close: string }[]>`
      select weekday, to_char(min(start_time), 'HH24:MI') as open, to_char(max(end_time), 'HH24:MI') as close
      from working_hours wh join barbers b on b.id = wh.barber_id where b.active
      group by weekday`,
  ]);

  const byWeekday = new Map(hours.map((h) => [h.weekday, h]));
  const weekOrder = [1, 2, 3, 4, 5, 6, 0];

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <header className="flex flex-col items-center pt-14 pb-10 text-center">
        <div className="mb-5 grid size-20 place-items-center rounded-full border border-accent/40 bg-surface text-3xl">
          💈
        </div>
        <h1 className="display text-4xl font-semibold">{settings.shop_name}</h1>
        {settings.address && <p className="mt-2 text-muted">{settings.address}</p>}
        <Link href="/marcar" className="btn-primary mt-8 w-full max-w-xs py-3.5 text-base">
          Marcar agora
        </Link>
      </header>

      <section className="card divide-y divide-line">
        <h2 className="display px-5 pt-5 pb-3 text-sm text-muted">Serviços</h2>
        {services.map((s) => (
          <Link
            key={s.id}
            href={`/marcar?servico=${s.id}`}
            className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-surface-2"
          >
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-muted">{s.duration_min} min</div>
            </div>
            <div className="font-semibold text-accent">{euros(s.price_cents)}</div>
          </Link>
        ))}
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="display mb-3 text-sm text-muted">Horário</h2>
          <ul className="space-y-1 text-sm">
            {weekOrder.map((d) => {
              const h = byWeekday.get(d);
              return (
                <li key={d} className="flex justify-between">
                  <span className="text-muted">{WEEKDAYS[d]}</span>
                  <span>{h ? `${h.open} – ${h.close}` : "Fechado"}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="display mb-3 text-sm text-muted">Equipa</h2>
          <ul className="space-y-2">
            {barbers.map((b) => (
              <li key={b.id} className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-surface-2 font-semibold text-accent">
                  {b.name[0]}
                </span>
                {b.name}
              </li>
            ))}
          </ul>
          {(settings.phone || settings.instagram) && (
            <div className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
              {settings.phone && (
                <a className="block text-muted hover:text-fg" href={`tel:${settings.phone}`}>
                  📞 {settings.phone}
                </a>
              )}
              {settings.instagram && (
                <a
                  className="block text-muted hover:text-fg"
                  href={`https://instagram.com/${settings.instagram.replace("@", "")}`}
                >
                  📷 {settings.instagram}
                </a>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
