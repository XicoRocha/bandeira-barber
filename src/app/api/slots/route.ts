import { getAvailableSlots } from "@/lib/availability";
import { isDayKey } from "@/lib/time";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const serviceId = Number(params.get("service"));
  const barber = params.get("barber");
  const day = params.get("day");
  if (!serviceId || !isDayKey(day)) {
    return Response.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }
  const slots = await getAvailableSlots({
    serviceId,
    barberId: barber && barber !== "any" ? Number(barber) : null,
    day,
  });
  return Response.json({ slots }, { headers: { "Cache-Control": "no-store" } });
}
