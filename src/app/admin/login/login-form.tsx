"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="input"
          // o React limpa o formulário depois de enviar; assim o email não se perde
          key={state && !state.ok ? state.email : ""}
          defaultValue={state && !state.ok ? state.email : ""}
        />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full py-3">
        {pending ? "A entrar…" : "Entrar"}
      </button>
    </form>
  );
}
