"use server";

import { after } from "next/server";
import { z } from "zod";
import { createBooking, type BookingResult } from "@/lib/booking";
import { notifyAppointment } from "@/lib/notify";

const schema = z.object({
  serviceId: z.coerce.number().int().positive(),
  barberId: z.string(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(9).max(20),
  email: z.union([z.literal(""), z.string().trim().email()]),
  website: z.string().optional(), // campo-armadilha para bots
});

export async function bookAppointment(input: z.input<typeof schema>): Promise<BookingResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Verifique os dados preenchidos." };
  const d = parsed.data;
  if (d.website) return { ok: false, error: "Pedido inválido." };

  const result = await createBooking({
    serviceId: d.serviceId,
    barberId: d.barberId === "any" ? null : Number(d.barberId),
    day: d.day,
    time: d.time,
    name: d.name,
    phone: d.phone,
    email: d.email || null,
    source: "online",
  });

  if (result.ok) after(() => notifyAppointment(result.appointmentId, "confirmation"));
  return result;
}
