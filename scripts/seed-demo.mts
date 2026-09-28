// Dados fictícios para experimentar a app (≈ 4 meses para trás e 2 semanas para a frente).
// Uso: npm run db:demo    ⚠️ NÃO correr na base de dados real — apaga clientes e marcações.
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { addDaysKey, dayKey, timeToMin, hhmm, weekdayOf, zoned } from "../src/lib/time";

const url = process.env.DATABASE_URL!;
if (!/127\.0\.0\.1|localhost/.test(url) && !process.argv.includes("--force")) {
  throw new Error("Isto parece a base de dados real. Use --force se tiver mesmo a certeza.");
}
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

await sql`delete from appointments`;
await sql`delete from customers`;
await sql`delete from time_off`;

const first = ["João", "Pedro", "Tiago", "Rui", "Miguel", "André", "Diogo", "Bruno", "Ricardo", "Nuno", "Tomás", "Afonso", "Rodrigo", "Gonçalo", "Francisco", "Duarte", "Hugo", "Luís", "Carlos", "Martim", "Vasco", "Filipe", "Daniel", "Fábio"];
const last = ["Silva", "Santos", "Ferreira", "Pereira", "Oliveira", "Costa", "Rodrigues", "Martins", "Sousa", "Fernandes", "Gonçalves", "Gomes", "Lopes", "Marques", "Almeida", "Ribeiro", "Pinto", "Carvalho"];

let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const customers: number[] = [];
for (let i = 0; i < 90; i++) {
  const [c] = await sql`insert into customers (name, phone, email) values (
    ${`${pick(first)} ${pick(last)}`}, ${"+3519" + String(10000000 + Math.floor(rand() * 89999999))},
    ${rand() < 0.4 ? `cliente${i}@exemplo.pt` : null}) on conflict (phone) do nothing returning id`;
  if (c) customers.push(c.id);
}
// Alguns clientes são muito mais habituais que outros
const weighted = customers.flatMap((id, i) => Array(i < 25 ? 6 : i < 55 ? 2 : 1).fill(id));

const services = await sql<{ id: number; duration_min: number; price_cents: number }[]>`select * from services where active`;
const hours = await sql<{ barber_id: number; weekday: number; start_time: string; end_time: string }[]>`
  select barber_id, weekday, to_char(start_time,'HH24:MI') as start_time, to_char(end_time,'HH24:MI') as end_time from working_hours`;

const today = dayKey();
const now = Date.now();
let n = 0;
for (let d = addDaysKey(today, -120); d <= addDaysKey(today, 14); d = addDaysKey(d, 1)) {
  const wd = weekdayOf(d);
  const future = d > today;
  // Mais movimento ao fim da tarde e ao sábado; menos no futuro (ainda não marcaram)
  const baseFill = (wd === 6 ? 0.85 : wd === 5 ? 0.75 : 0.55) * (future ? Math.max(0.1, 0.7 - (zoned(d).getTime() - now) / 864e5 / 20) : 1);
  for (const block of hours.filter((h) => h.weekday === wd)) {
    let m = timeToMin(block.start_time);
    const end = timeToMin(block.end_time);
    while (m < end) {
      const svc = pick(services);
      if (m + svc.duration_min > end) break;
      const eveningBoost = m >= 17 * 60 ? 0.15 : 0;
      if (rand() < baseFill + eveningBoost) {
        const starts = zoned(d, hhmm(m));
        const past = starts.getTime() < now;
        const r = rand();
        const status = past ? (r < 0.04 ? "no_show" : r < 0.09 ? "cancelled" : "booked") : r < 0.05 ? "cancelled" : "booked";
        const created = new Date(starts.getTime() - (1 + rand() * 6) * 86_400_000);
        await sql`insert into appointments
          (barber_id, service_id, customer_id, starts_at, ends_at, price_cents, status, source, token, created_at)
          values (${block.barber_id}, ${svc.id}, ${pick(weighted)}, ${starts},
            ${new Date(starts.getTime() + svc.duration_min * 60_000)}, ${svc.price_cents}, ${status},
            ${rand() < 0.75 ? "online" : "admin"}, ${randomBytes(12).toString("base64url")},
            ${created > new Date() ? new Date() : created})`;
        n++;
        m += svc.duration_min;
      } else {
        m += 15;
      }
    }
  }
}
// Os primeiros clientes passam a ter a data de criação da 1.ª visita
await sql`update customers c set created_at = (select min(created_at) from appointments a where a.customer_id = c.id)
          where exists (select 1 from appointments a where a.customer_id = c.id)`;
console.log(`✓ ${customers.length} clientes, ${n} marcações de demonstração`);
await sql.end();
