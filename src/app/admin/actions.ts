"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { createSession, destroySession, requireStaff } from "@/lib/auth";
import { getAvailableSlots } from "@/lib/availability";
import { createBooking } from "@/lib/booking";
import { sql, type AppointmentStatus } from "@/lib/db";
import { notifyAppointment } from "@/lib/notify";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isDayKey, zoned } from "@/lib/time";

type Result = { ok: true; message?: string } | { ok: false; error: string; email?: string };

// ─── Sessão ────────────────────────────────────────────────────────────────

export async function login(_prev: Result | null, formData: FormData): Promise<Result> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const [user] = await sql<{ id: number; password_hash: string }[]>`
    select id, password_hash from staff where email = ${email}`;
  const valid = user && (await verifyPassword(password, user.password_hash));
  if (!valid) {
    await new Promise((r) => setTimeout(r, 600)); // abranda tentativas de adivinhar a password
    return { ok: false, error: "Email ou password errados.", email };
  }
  await createSession(user.id);
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

// ─── Marcações ─────────────────────────────────────────────────────────────

export async function setAppointmentStatus(id: number, status: AppointmentStatus, notify = false) {
  await requireStaff();
  const [a] = await sql<{ id: number }[]>`
    update appointments set status = ${status},
      cancelled_at = ${status === "cancelled" ? sql`now()` : sql`null`}
    where id = ${id} returning id`;
  if (a && status === "cancelled" && notify) after(() => notifyAppointment(id, "cancellation"));
  refresh();
}

export async function adminSlots(serviceId: number, barberId: number, day: string) {
  await requireStaff();
  if (!isDayKey(day)) return [];
  const slots = await getAvailableSlots({ serviceId, barberId, day, forAdmin: true });
  return slots.map((s) => s.time);
}

const adminBookingSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  barberId: z.coerce.number().int().positive(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(2),
  phone: z.string().trim().min(9),
  email: z.union([z.literal(""), z.string().trim().email()]).optional(),
  notes: z.string().optional(),
  notify: z.string().optional(),
});

export async function adminCreateBooking(_prev: Result | null, formData: FormData): Promise<Result> {
  await requireStaff();
  const parsed = adminBookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Preencha serviço, barbeiro, hora, nome e telemóvel." };
  const d = parsed.data;
  const res = await createBooking({
    serviceId: d.serviceId,
    barberId: d.barberId,
    day: d.day,
    time: d.time,
    name: d.name,
    phone: d.phone,
    email: d.email || null,
    notes: d.notes,
    source: "admin",
  });
  if (!res.ok) return res;
  if (d.notify === "on" && zoned(d.day, d.time).getTime() > Date.now()) {
    after(() => notifyAppointment(res.appointmentId, "confirmation"));
  }
  refresh();
  return { ok: true, message: "Marcação criada." };
}

const timeOffSchema = z.object({
  barberId: z.coerce.number().int().positive(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  from: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  to: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  reason: z.string().optional(),
});

/** Bloquear horas (pausa, consulta…) ou dias inteiros (férias) */
export async function addTimeOff(_prev: Result | null, formData: FormData): Promise<Result> {
  await requireStaff();
  const parsed = timeOffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const d = parsed.data;
  const allDay = !d.from || !d.to;
  const starts = zoned(d.day, allDay ? "00:00" : d.from!);
  const lastDay = d.dayTo && d.dayTo >= d.day ? d.dayTo : d.day;
  const ends = allDay
    ? new Date(zoned(lastDay, "00:00").getTime() + 24 * 3_600_000)
    : zoned(d.day, d.to!);
  if (ends <= starts) return { ok: false, error: "A hora de fim tem de ser depois da de início." };

  await sql`insert into time_off (barber_id, starts_at, ends_at, reason)
            values (${d.barberId}, ${starts}, ${ends}, ${d.reason ?? ""})`;
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from appointments
    where barber_id = ${d.barberId} and status = 'booked'
      and starts_at < ${ends} and ends_at > ${starts}`;
  refresh();
  return {
    ok: true,
    message: n
      ? `Bloqueado. Atenção: já há ${n} marcação(ões) nesse período — reveja a agenda.`
      : "Bloqueado.",
  };
}

export async function deleteTimeOff(id: number) {
  await requireStaff();
  await sql`delete from time_off where id = ${id}`;
  refresh();
}

// ─── Clientes ──────────────────────────────────────────────────────────────

export async function updateCustomer(id: number, _prev: Result | null, formData: FormData): Promise<Result> {
  await requireStaff();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "");
  if (name.length < 2) return { ok: false, error: "Nome inválido." };
  await sql`update customers set name = ${name}, email = ${email}, notes = ${notes} where id = ${id}`;
  refresh();
  return { ok: true, message: "Guardado." };
}

// ─── Definições ────────────────────────────────────────────────────────────

async function requireOwner() {
  const user = await requireStaff();
  if (user.role !== "owner") throw new Error("Só o gestor pode alterar definições.");
  return user;
}

export async function saveSettings(_prev: Result | null, formData: FormData): Promise<Result> {
  await requireOwner();
  const f = Object.fromEntries(formData) as Record<string, string>;
  const int = (k: string, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.round(Number(f[k]) || 0)));
  await sql`
    update settings set
      shop_name = ${f.shop_name?.trim() || "Bandeira Barber"},
      address = ${f.address?.trim() ?? ""},
      phone = ${f.phone?.trim() ?? ""},
      instagram = ${f.instagram?.trim() ?? ""},
      slot_minutes = ${int("slot_minutes", 5, 60)},
      min_notice_minutes = ${int("min_notice_minutes", 0, 2880)},
      max_days_ahead = ${int("max_days_ahead", 1, 180)},
      cancel_limit_hours = ${int("cancel_limit_hours", 0, 72)}
    where id = 1`;
  refresh();
  return { ok: true, message: "Guardado." };
}

export async function saveService(_prev: Result | null, formData: FormData): Promise<Result> {
  await requireOwner();
  const id = Number(formData.get("id")) || null;
  const name = String(formData.get("name") ?? "").trim();
  const duration = Math.round(Number(formData.get("duration_min")));
  const price = Math.round(Number(String(formData.get("price")).replace(",", ".")) * 100);
  const active = formData.get("active") === "on";
  if (!name || !(duration > 0) || !(price >= 0)) {
    return { ok: false, error: "Nome, duração e preço são obrigatórios." };
  }
  if (id) {
    await sql`update services set name = ${name}, duration_min = ${duration},
              price_cents = ${price}, active = ${active} where id = ${id}`;
  } else {
    await sql`insert into services (name, duration_min, price_cents, sort)
              values (${name}, ${duration}, ${price}, (select coalesce(max(sort), 0) + 1 from services))`;
  }
  refresh();
  return { ok: true, message: "Guardado." };
}

/** Horário semanal de um barbeiro. Cada dia: "09:30-13:00, 14:30-19:30" ou vazio (folga). */
export async function saveBarber(_prev: Result | null, formData: FormData): Promise<Result> {
  await requireOwner();
  const id = Number(formData.get("id")) || null;
  const name = String(formData.get("name") ?? "").trim();
  const active = formData.get("active") === "on";
  if (!name) return { ok: false, error: "O barbeiro precisa de um nome." };

  const blocks: { weekday: number; start: string; end: string }[] = [];
  for (let wd = 0; wd < 7; wd++) {
    const raw = String(formData.get(`wd${wd}`) ?? "").trim();
    if (!raw) continue;
    for (const part of raw.split(/[,;]/)) {
      const m = part.trim().match(/^(\d{1,2})[:h]?(\d{2})?\s*[-–]\s*(\d{1,2})[:h]?(\d{2})?$/);
      if (!m) return { ok: false, error: `Horário inválido: "${part.trim()}". Use por ex. 09:30-13:00` };
      const start = `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`;
      const end = `${m[3].padStart(2, "0")}:${m[4] ?? "00"}`;
      if (end <= start || end > "24:00") return { ok: false, error: `Horário inválido: "${part.trim()}"` };
      blocks.push({ weekday: wd, start, end });
    }
  }

  await sql.begin(async (tx) => {
    let barberId = id;
    if (barberId) {
      await tx`update barbers set name = ${name}, active = ${active} where id = ${barberId}`;
    } else {
      const [b] = await tx<{ id: number }[]>`
        insert into barbers (name, sort) values (${name}, (select coalesce(max(sort), 0) + 1 from barbers))
        returning id`;
      barberId = b.id;
    }
    await tx`delete from working_hours where barber_id = ${barberId}`;
    for (const b of blocks) {
      await tx`insert into working_hours (barber_id, weekday, start_time, end_time)
               values (${barberId}, ${b.weekday}, ${b.start}, ${b.end})`;
    }
  });
  refresh();
  return { ok: true, message: "Guardado." };
}

export async function changePassword(_prev: Result | null, formData: FormData): Promise<Result> {
  const user = await requireStaff();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const [row] = await sql<{ password_hash: string }[]>`select password_hash from staff where id = ${user.id}`;
  if (!(await verifyPassword(current, row.password_hash))) {
    return { ok: false, error: "A password atual está errada." };
  }
  if (next.length < 8) return { ok: false, error: "A nova password precisa de pelo menos 8 caracteres." };
  await sql`update staff set password_hash = ${await hashPassword(next)} where id = ${user.id}`;
  return { ok: true, message: "Password alterada." };
}

export async function addStaff(_prev: Result | null, formData: FormData): Promise<Result> {
  await requireOwner();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const barberId = Number(formData.get("barberId")) || null;
  if (!email.includes("@") || !name || password.length < 8) {
    return { ok: false, error: "Nome, email e password (mín. 8 caracteres) são obrigatórios." };
  }
  try {
    await sql`insert into staff (email, name, password_hash, role, barber_id)
              values (${email}, ${name}, ${await hashPassword(password)}, 'barber', ${barberId})`;
  } catch {
    return { ok: false, error: "Já existe uma conta com esse email." };
  }
  refresh();
  return { ok: true, message: `Conta criada para ${name}.` };
}
