"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/primitives";

/**
 * Whether Microsoft Entra ID sign-in is wired up.
 *
 * Flipped by the deployment once the app registration exists — tenant, client
 * id and redirect URI. Until then the button renders in a stated pending state
 * rather than failing on click, because a dead sign-in button teaches people
 * the product is broken.
 */
const SSO_READY = false;

/** Microsoft's four-square mark, drawn inline so it needs no asset. */
function MicrosoftMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 23 23" aria-hidden="true" className={className}>
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

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
    <div className="mt-7">
      {/* Organisation sign-in first: it is the path most people should take
          once it exists, and the access code is the fallback beneath it. */}
      <button
        type="button"
        disabled={!SSO_READY}
        aria-describedby={SSO_READY ? undefined : "sso-status"}
        onClick={() => {
          /* Left unwired on purpose. The real handler starts the Entra ID
             authorization-code flow, which is a full-page redirect out to
             Microsoft and back to a callback route — not a client-side
             navigation. Nothing here should guess at that shape before the app
             registration exists. */
        }}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] border border-line-strong bg-white text-[13.5px] font-medium text-ink transition-colors enabled:hover:border-hud enabled:hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-55"
      >
        <MicrosoftMark className="size-4" />
        Sign in with Microsoft
      </button>

      {SSO_READY ? null : (
        <p id="sso-status" className="mt-2 text-[11.5px] leading-snug text-ink-4">
          Single sign-on is not configured on this deployment yet. Use the access code below.
        </p>
      )}

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10.5px] tracking-[0.14em] text-ink-4 uppercase">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

    <form onSubmit={onSubmit}>
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
    </div>
  );
}
