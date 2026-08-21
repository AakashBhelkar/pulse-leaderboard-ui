"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/overview";

  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "That access code is not recognised.");
        setPending(false);
        return;
      }
      router.replace(next.startsWith("/") ? next : "/overview");
      router.refresh();
    } catch {
      setError("Could not reach the sign-in service. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-7">
      <label htmlFor="access-code" className="eyebrow">
        Access code
      </label>
      <div className="relative mt-2">
        <input
          id="access-code"
          type={reveal ? "text" : "password"}
          value={password}
          autoFocus
          autoComplete="current-password"
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(null);
          }}
          placeholder="••••••••••"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "access-error" : undefined}
          className="h-11 w-full rounded-[10px] border border-line-strong bg-surface-sunken px-3.5 pr-11 font-mono text-[14px] tracking-[0.06em] text-ink transition-colors outline-none placeholder:tracking-[0.2em] placeholder:text-ink-4 focus:border-brand-500 focus:bg-white"
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          aria-label={reveal ? "Hide access code" : "Show access code"}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-2 text-ink-4 transition-colors hover:bg-canvas-deep hover:text-ink-2"
        >
          {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      {error ? (
        <p
          id="access-error"
          role="alert"
          className="mt-2.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-negative"
        >
          <TriangleAlert className="mt-[1px] size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={pending || password.length === 0}
        className="mt-5 w-full"
      >
        {pending ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            Verifying
          </>
        ) : (
          <>
            Open workspace
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  );
}
