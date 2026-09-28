import Link from "next/link";
import { getBarbers, sql } from "@/lib/db";
import {
  getByBarber,
  getByService,
  getHeatmap,
  getKpis,
  getLapsedCustomers,
  getRevenueByDay,
  hourRange,
  periodFromDays,
} from "@/lib/stats";
import { addDaysKey, euros, fmt, fmtDateShort, WEEKDAYS_SHORT, zoned } from "@/lib/time";
import { BarChart, HBars, Heatmap } from "@/components/charts";
import { ContactLinks, Delta, Kpi, PageTitle } from "@/components/ui";

const PERIODS = { "7": "7 dias", "30": "30 dias", "90": "3 meses", "365": "12 meses" } as const;

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default async function EstatisticasPage(props: PageProps<"/admin/estatisticas">) {
  const sp = await props.searchParams;
  const pKey = (typeof sp.p === "string" && sp.p in PERIODS ? sp.p : "30") as keyof typeof PERIODS;
  const days = Number(pKey);
  const barberId = Number(sp.b) || null;

  const period = periodFromDays(days);
  const previous = { from: addDaysKey(period.from, -days), to: period.from };

  const [barbers, kpis, prev, byDay, byService, byBarber, heat, lapsed, hours] = await Promise.all([
    getBarbers(),
    getKpis(period, barberId),
    getKpis(previous, barberId),
    getRevenueByDay(period, barberId),
    getByService(period, barberId),
    getByBarber(period),
    getHeatmap(period, barberId),
    getLapsedCustomers(),
    sql<{ weekday: number; start_time: string; end_time: string }[]>`
      select weekday, to_char(start_time,'HH24:MI') as start_time, to_char(end_time,'HH24:MI') as end_time
      from working_hours`,
  ]);

  // Agrupar por semana (3 meses) ou mês (12 meses) para o gráfico não ficar ilegível
  const buckets = new Map<string, { label: string; value: number; count: number }>();
  for (const d of byDay) {
    const date = zoned(d.day, "12:00");
    const key =
      days <= 30 ? d.day : days <= 90 ? addDaysKey(d.day, -((date.getUTCDay() + 6) % 7)) : d.day.slice(0, 7);
    const label =
      days <= 30 ? fmt(date, "d/M") : days <= 90 ? fmt(zoned(key, "12:00"), "d MMM") : fmt(date, "MMM");
    const b = buckets.get(key) ?? { label, value: 0, count: 0 };
    b.value += d.revenue;
    b.count += d.count;
    buckets.set(key, b);
  }
  const unit = days <= 30 ? "" : days <= 90 ? "semana de " : "";
  const chartData = [...buckets.values()].map((b) => ({
    label: b.label,
    value: b.value,
    tooltip: `${unit}${b.label}: ${euros(b.value)} · ${b.count} cortes`,
  }));

  const heatMap = new Map(heat.map((h) => [`${h.weekday}-${h.hour}`, h.count]));
  const { min, max } = hourRange(hours);
  const workDays = [1, 2, 3, 4, 5, 6, 0].filter((d) => hours.some((h) => h.weekday === d) || heat.some((h) => h.weekday === d));

  const qs = (p: string, b: number | null) => `/admin/estatisticas?p=${p}${b ? `&b=${b}` : ""}`;

  return (
    <>
      <PageTitle>Números</PageTitle>

      <div className="mb-5 flex flex-wrap gap-2">
        <div className="flex rounded-xl border border-line bg-surface p-1">
          {Object.entries(PERIODS).map(([k, label]) => (
            <Link
              key={k}
              href={qs(k, barberId)}
              className={`rounded-lg px-3 py-1.5 text-sm ${k === pKey ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"}`}
            >
              {label}
            </Link>
          ))}
        </div>
        {barbers.length > 1 && (
          <div className="flex rounded-xl border border-line bg-surface p-1">
            {[{ id: null, name: "Todos" }, ...barbers].map((b) => (
              <Link
                key={b.id ?? 0}
                href={qs(pKey, b.id)}
                className={`rounded-lg px-3 py-1.5 text-sm ${b.id === barberId ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"}`}
              >
                {b.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Faturação"
          value={euros(kpis.revenue)}
          hint={<><Delta now={kpis.revenue} before={prev.revenue} /> vs. período anterior</>}
        />
        <Kpi label="Cortes feitos" value={String(kpis.done)} hint={<Delta now={kpis.done} before={prev.done} />} />
        <Kpi label="Valor médio" value={euros(kpis.avgTicket)} hint="por cliente atendido" />
        <Kpi label="Ocupação" value={pct(kpis.occupancy)} hint="do horário de trabalho preenchido" />
        <Kpi
          label="Clientes"
          value={String(kpis.customers)}
          hint={`${kpis.new_customers} novos · ${kpis.returningCustomers} habituais`}
        />
        <Kpi label="Faltas" value={pct(kpis.noShowRate)} hint={`${kpis.no_show} clientes não apareceram`} />
        <Kpi label="Cancelamentos" value={pct(kpis.cancelRate)} hint={`${kpis.cancelled} marcações`} />
        <Kpi
          label="Marcações online"
          value={pct(kpis.total - kpis.cancelled ? kpis.online / (kpis.total - kpis.cancelled) : 0)}
          hint="o resto foi registado na gestão"
        />
      </div>

      <section className="card mt-6 p-5">
        <h2 className="display mb-4 text-lg">
          Faturação {days <= 30 ? "por dia" : days <= 90 ? "por semana" : "por mês"}
        </h2>
        <BarChart
          data={chartData}
          format={(v) => euros(Math.round(v))}
          labelEvery={days === 30 ? 3 : 1}
          caption="Faturação ao longo do período"
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="display mb-4 text-lg">Serviços</h2>
          {byService.length === 0 ? (
            <p className="text-muted">Sem dados.</p>
          ) : (
            <HBars
              data={byService.map((s) => ({
                label: s.name,
                value: s.revenue,
                detail: `${s.count}× · ${euros(s.revenue)}`,
              }))}
            />
          )}
        </section>

        {!barberId && barbers.length > 1 && (
          <section className="card p-5">
            <h2 className="display mb-4 text-lg">Por barbeiro</h2>
            <HBars
              data={byBarber.map((b) => ({
                label: b.name,
                value: b.revenue,
                detail: `${b.count} cortes · ${euros(b.revenue)}${b.no_show ? ` · ${b.no_show} faltas` : ""}`,
              }))}
            />
          </section>
        )}

        <section className="card p-5 lg:col-span-2">
          <h2 className="display mb-1 text-lg">Horas de maior procura</h2>
          <p className="mb-4 text-sm text-muted">Nº de marcações por dia da semana e hora. Útil para decidir horários e pausas.</p>
          <Heatmap
            rows={workDays.map((d) => ({ weekday: d, label: WEEKDAYS_SHORT[d] }))}
            hours={Array.from({ length: max - min }, (_, i) => min + i)}
            value={(wd, h) => heatMap.get(`${wd}-${h}`) ?? 0}
          />
        </section>

        <section className="card p-5 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="display text-lg">Clientes a recuperar</h2>
            <Link href="/admin/clientes?f=inativos" className="text-sm text-accent hover:underline">Ver todos →</Link>
          </div>
          <p className="mb-3 text-sm text-muted">Vieram pelo menos 2 vezes mas não aparecem há mais de 45 dias.</p>
          {lapsed.length === 0 ? (
            <p className="text-muted">Nenhum — ótimo sinal!</p>
          ) : (
            <div className="divide-y divide-line">
              {lapsed.slice(0, 8).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/clientes/${c.id}`} className="min-w-0">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="text-sm text-muted">
                      {c.visits} visitas · última {fmtDateShort(c.last_visit)}
                    </div>
                  </Link>
                  <ContactLinks phone={c.phone} name={c.name} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
