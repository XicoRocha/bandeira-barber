import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { sql } from "./db";

const COOKIE = "bb_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias — o barbeiro não quer fazer login todos os dias

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET em falta ou demasiado curto");
  return new TextEncoder().encode(s);
}

export type StaffUser = {
  id: number;
  email: string;
  name: string;
  role: "owner" | "barber";
  barber_id: number | null;
};

export async function createSession(staffId: number) {
  const jwt = await new SignJWT({ sub: String(staffId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export const getStaff = cache(async (): Promise<StaffUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const [user] = await sql<StaffUser[]>`
      select id, email, name, role, barber_id from staff where id = ${Number(payload.sub)}`;
    return user ?? null;
  } catch {
    return null;
  }
});

/** Usar em todas as páginas e server actions da gestão */
export async function requireStaff() {
  const user = await getStaff();
  if (!user) redirect("/admin/login");
  return user;
}
