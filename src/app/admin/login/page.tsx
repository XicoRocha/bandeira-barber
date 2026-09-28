import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Gestão — Entrar", robots: { index: false } };

export default async function LoginPage() {
  if (await getStaff()) redirect("/admin");
  return (
    <main className="grid flex-1 place-items-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="display mb-1 text-center text-3xl">Gestão</h1>
        <p className="mb-8 text-center text-muted">Bandeira Barber</p>
        <LoginForm />
      </div>
    </main>
  );
}
