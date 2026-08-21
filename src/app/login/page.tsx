import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { BrandLockup } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Sign in · Solar Forecast Model Leaderboard" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-masthead">
      {/* Ambient field: a dawn gradient over a faint array grid. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(1100px 620px at 78% -8%, rgba(240,181,68,0.22), transparent 62%), radial-gradient(900px 520px at 12% 108%, rgba(60,160,122,0.20), transparent 60%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(760px 520px at 50% 40%, black, transparent 78%)",
        }}
      />

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-14">
        <div className="w-full max-w-[900px]">
          <div className="grid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_36px_90px_-30px_rgba(0,0,0,0.85)] backdrop-blur-xl md:grid-cols-[1.05fr_1fr]">
            {/* Narrative panel */}
            <div className="hidden flex-col justify-between border-r border-white/10 p-9 md:flex">
              <BrandLockup />

              <div>
                <p className="eyebrow text-ondark-4">Historical model evaluation</p>
                <h1 className="mt-4 text-[27px] leading-[1.18] font-semibold tracking-[-0.025em] text-white">
                  Which forecast model
                  <br />
                  actually tracked the plant?
                </h1>
                <p className="mt-4 max-w-[38ch] text-[13px] leading-relaxed text-ondark-2">
                  Head-to-head evaluation of External QCA, Sunsure Internal and Nevron against
                  measured generation, at 15-minute resolution.
                </p>

                <ul className="mt-8 space-y-3">
                  {[
                    "Independent winners per metric — no composite score",
                    "Actual as the visual anchor, with a tolerance envelope",
                    "Every metric carries its definition and its denominator",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-3 text-[12.5px] text-ondark-2">
                      <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-accent-400" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-[11px] tracking-[0.14em] text-ondark-4 uppercase">
                Erandol 20 MW · Gursarai 12 MW
              </p>
            </div>

            {/* Form panel */}
            <div className="bg-white p-8 sm:p-9">
              <div className="md:hidden">
                <BrandLockup tone="dark" />
                <div className="mt-6 h-px bg-line" />
              </div>

              <div className="mt-6 md:mt-0">
                <p className="eyebrow">Restricted workspace</p>
                <h2 className="mt-3 text-[19px] font-semibold tracking-[-0.015em] text-ink">
                  Enter access code
                </h2>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
                  This prototype is shared with a single access code. It is validated on the
                  server and never reaches the browser bundle.
                </p>
              </div>

              <Suspense fallback={<div className="skeleton mt-7 h-11 w-full" />}>
                <LoginForm />
              </Suspense>

              <p className="mt-7 border-t border-line pt-4 text-[11px] leading-relaxed text-ink-4">
                Historical evaluation only. This workspace does not schedule, revise or submit
                generation, and it does not determine settlement liability.
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-[11.5px] text-ondark-4">
            v2 prototype · all figures simulated
          </p>
        </div>
      </div>
    </main>
  );
}
