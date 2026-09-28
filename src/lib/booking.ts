import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "./db";
import { getAvailableSlots } from "./availability";
import { zoned } from "./time";

/** Normaliza para +351… Aceita "912 345 678", "00351912345678", "+44 7…". Devolve null se inválido. */
export function normalizePhone(input: string) {
  let p = input.replace(/[\s().-]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (/^[29]\d{8}$/.test(p)) p = "+351" + p;
  return /^\+\d{8,15}$/.test(p) ? p : null;
}

export type BookingInput = {
  serviceId: number;
  barberId: number | null; // null = qualquer
  day: string;
  time: string;
  name: string;
  phone: string;
  email: string | null;
  notes?: string;
  source: "online" | "admin";
};

export type BookingResult =
  | { ok: true; appointmentId: number; token: string }
  | { ok: false; error: string };

export async function createBooking(input: BookingInput): Promise<BookingResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "Número de telemóvel inválido." };
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, error: "Indique o seu nome." };

  const [service] = await sql<{ id: number; duration_min: number; price_cents: number }[]>`
    select id, duration_min, price_cents from services where id = ${input.serviceId} and active`;
  if (!service) return { ok: false, error: "Serviço indisponível." };

  const slots = await getAvailableSlots({
    serviceId: service.id,
    barberId: input.barberId,
    day: input.day,
    forAdmin: input.source === "admin",
  });
  const slot = slots.find((s) => s.time === input.time);
  if (!slot) return { ok: false, error: "Esse horário já não está disponível. Escolha outro." };

  const startsAt = zoned(input.day, input.time);
  const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000);

  // "Qualquer barbeiro": distribuir para quem tem menos marcações nesse dia
  let barberId = input.barberId ?? slot.barberIds[0];
  if (!input.barberId && slot.barberIds.length > 1) {
    const loads = await sql<{ barber_id: number; n: number }[]>`
      select barber_id, count(*)::int as n from appointments
      where status in ('booked','completed') and barber_id = any(${slot.barberIds})
        and (starts_at at time zone 'Europe/Lisbon')::date = ${input.day}::date
      group by barber_id`;
    const load = (id: number) => loads.find((l) => l.barber_id === id)?.n ?? 0;
    barberId = [...slot.barberIds].sort((a, b) => load(a) - load(b))[0];
  }

  try {
    return await sql.begin(async (tx) => {
      const [customer] = await tx<{ id: number }[]>`
        insert into customers (name, phone, email) values (${name}, ${phone}, ${input.email})
        on conflict (phone) do update set
          name = excluded.name,
          email = coalesce(excluded.email, customers.email)
        returning id`;

      if (input.source === "online") {
        // Travão simples contra abusos: máx. 3 marcações futuras por número
        const [{ n }] = await tx<{ n: number }[]>`
          select count(*)::int as n from appointments
          where customer_id = ${customer.id} and status = 'booked' and starts_at > now()`;
        if (n >= 3) {
          return {
            ok: false as const,
            error: "Já tem 3 marcações ativas. Cancele uma ou contacte a barbearia.",
          };
        }
      }

      const token = randomBytes(12).toString("base64url");
      const [appt] = await tx<{ id: number }[]>`
        insert into appointments
          (barber_id, service_id, customer_id, starts_at, ends_at, price_cents, source, notes, token)
        values
          (${barberId}, ${service.id}, ${customer.id}, ${startsAt}, ${endsAt},
           ${service.price_cents}, ${input.source}, ${input.notes ?? ""}, ${token})
        returning id`;
      return { ok: true as const, appointmentId: appt.id, token };
    });
  } catch (err) {
    // 23P01 = violação da restrição no_overlap (alguém marcou no mesmo instante)
    if ((err as { code?: string }).code === "23P01") {
      return { ok: false, error: "Esse horário acabou de ser ocupado. Escolha outro." };
    }
    throw err;
  }
}
