// Gráficos simples em HTML/CSS: uma só série, cor de destaque, tooltip ao passar/tocar.

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export function BarChart(props: {
  data: { label: string; value: number; tooltip: string }[];
  format: (v: number) => string;
  labelEvery?: number;
  caption: string;
}) {
  const max = niceMax(Math.max(...props.data.map((d) => d.value), 0));
  const every = props.labelEvery ?? 1;
  return (
    <figure>
      <div className="relative h-44 pl-12">
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="absolute inset-x-0 flex items-center" style={{ bottom: `${f * 100}%` }}>
            <span className="w-11 pr-2 text-right text-[11px] text-muted tabular-nums">{props.format(max * f)}</span>
            <div className={`h-px flex-1 ${f === 0 ? "bg-line" : "bg-line/50"}`} />
          </div>
        ))}
        <div className="relative flex h-full items-end gap-[2px]">
          {props.data.map((d, i) => (
            <div key={i} className="group relative flex h-full flex-1 items-end" tabIndex={0}>
              <div
                className="w-full rounded-t-[4px] bg-accent transition-colors group-hover:bg-accent-strong group-focus:bg-accent-strong"
                style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0 }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg group-hover:block group-focus:block">
                {d.tooltip}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px] pl-12">
        {props.data.map((d, i) => (
          <div key={i} className="flex-1 truncate text-center text-[10px] text-muted">
            {i % every === 0 ? d.label : ""}
          </div>
        ))}
      </div>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer">Ver tabela</summary>
        <table className="mt-2 w-full">
          <tbody>
            {props.data.map((d, i) => (
              <tr key={i} className="border-b border-line/50">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right tabular-nums">{props.format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <figcaption className="sr-only">{props.caption}</figcaption>
    </figure>
  );
}

export function HBars(props: { data: { label: string; value: number; detail: string }[] }) {
  const max = Math.max(...props.data.map((d) => d.value), 1);
  return (
    <ul className="space-y-3">
      {props.data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate">{d.label}</span>
            <span className="shrink-0 text-muted tabular-nums">{d.detail}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-2 rounded-full bg-accent" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Mapa de calor: dias da semana × horas. Uma cor, mais escuro = mais marcações. */
export function Heatmap(props: {
  rows: { label: string; weekday: number }[];
  hours: number[];
  value: (weekday: number, hour: number) => number;
}) {
  const max = Math.max(1, ...props.rows.flatMap((r) => props.hours.map((h) => props.value(r.weekday, h))));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[2px] text-[11px]">
        <thead>
          <tr>
            <th />
            {props.hours.map((h) => (
              <th key={h} className="font-normal text-muted">{h}h</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r) => (
            <tr key={r.weekday}>
              <td className="pr-2 text-muted">{r.label}</td>
              {props.hours.map((h) => {
                const v = props.value(r.weekday, h);
                const t = v / max;
                return (
                  <td
                    key={h}
                    title={`${r.label} ${h}h: ${v} marcações`}
                    className="h-7 min-w-7 rounded-[4px] text-center tabular-nums"
                    style={{
                      background: v
                        ? `color-mix(in oklab, var(--accent) ${Math.round(15 + t * 85)}%, var(--surface))`
                        : "var(--surface-2)",
                      color: t > 0.55 ? "var(--accent-fg)" : "var(--muted)",
                    }}
                  >
                    {v || ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
