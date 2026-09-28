// Cria as tabelas, dados iniciais e a conta do gestor.
// Uso: npm run db:setup   (lê DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD do .env.local)
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { hashPassword } from "../src/lib/password";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL");
const sql = postgres(url, { prepare: false, onnotice: () => {} });

await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
console.log("✓ Tabelas criadas");

const [{ count: barberCount }] = await sql`select count(*)::int as count from barbers`;
if (barberCount === 0) {
  const barbers = await sql`
    insert into barbers (name, sort) values ('Bandeira', 0), ('Barbeiro 2', 1) returning id`;
  await sql`
    insert into services (name, description, duration_min, price_cents, sort) values
      ('Corte de cabelo', '', 30, 1600, 0),
      ('Corte cabelo + barba', '', 45, 2000, 1),
      ('Corte barba', '', 20, 1000, 2)`;
  // Horário inicial: terça a sábado, 9:30–13:00 e 14:30–19:30 (editável em Gestão → Definições)
  for (const b of barbers) {
    for (const weekday of [2, 3, 4, 5, 6]) {
      await sql`insert into working_hours (barber_id, weekday, start_time, end_time) values
        (${b.id}, ${weekday}, '09:30', '13:00'), (${b.id}, ${weekday}, '14:30', '19:30')`;
    }
  }
  console.log("✓ Barbeiros, serviços e horários iniciais");
}

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (email && password) {
  const [first] = await sql`select id from barbers order by sort, id limit 1`;
  await sql`
    insert into staff (email, name, password_hash, role, barber_id)
    values (${email}, 'Gestor', ${await hashPassword(password)}, 'owner', ${first?.id ?? null})
    on conflict (email) do update set password_hash = excluded.password_hash`;
  console.log(`✓ Conta de gestor: ${email}`);
} else {
  console.log("! Define ADMIN_EMAIL e ADMIN_PASSWORD para criar a conta do gestor");
}

await sql.end();
