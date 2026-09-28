"use client";

import { useState, useTransition } from "react";
import { cancelByCustomer } from "./actions";

export function CancelButton({ token }: { token: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="btn-danger w-full">
        Cancelar marcação
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <p className="text-sm">Tem a certeza que quer cancelar?</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setConfirming(false)} className="btn-ghost">
          Não
        </button>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await cancelByCustomer(token);
              if (!res.ok) setError(res.error);
            })
          }
          className="btn-danger"
        >
          {pending ? "A cancelar…" : "Sim, cancelar"}
        </button>
      </div>
    </div>
  );
}
