import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { VendorLockup, ModelLogo } from "@/components/brand/model-logo";
import { MODEL_LIST } from "@/lib/config/models";
import { PLANT_LIST } from "@/lib/config/plants";
import { bandAPct } from "@/lib/config/band";

export const metadata: Metadata = { title: "Sign in · Solar Forecast Model Leaderboard" };

const INSTALLED_MW = PLANT_LIST.reduce((sum, p) => sum + p.capacity_mw, 0);

/* The band tolerance differs per state, so the sign-in screen states the range
   it actually spans rather than picking one plant's figure and implying it is
   the rule everywhere. */
const BAND_RANGE = (() => {
  const pcts = [...new Set(PLANT_LIST.map((p) => bandAPct(p)))].sort((a, b) => a - b);
  return pcts.length === 1 ? `±${pcts[0]}%` : `±${pcts[0]}–${pcts[pcts.length - 1]}%`;
})();

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-masthead">
      {/* Dawn wash and array grid — the same ambient treatment the fleet
          overview header uses, so the product is recognisable before sign-in. */}
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

      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-12 sm:px-6">
        <div className="w-full max-w-[940px]">
          <div className="relative grid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_36px_90px_-30px_rgba(0,0,0,0.85)] backdrop-blur-xl md:grid-cols-[1.08fr_1fr]">
            {/* Registration marks, as on the workspace panels. */}
            <span aria-hidden="true" className="fx-corners z-20">
              <i />
              <i />
              <i />
              <i />
            </span>

            {/* ---------- Narrative panel ---------- */}
            <div className="hidden flex-col justify-between gap-10 border-r border-white/10 p-9 md:flex">
              <VendorLockup height={15} />

              <div>
                <p className="eyebrow text-ondark-4">Historical model evaluation</p>
                <h1 className="mt-4 text-[28px] leading-[1.16] font-semibold tracking-[-0.028em] text-white">
                  Which forecast model
                  <br />
                  actually tracked the plant?
                </h1>
                <p className="mt-4 max-w-[40ch] text-[13px] leading-relaxed text-ondark-2">
                  Three generation forecasts, measured against what the plant really produced,
                  block by block — and priced, so the difference is legible in rupees as well as
                  megawatts.
                </p>

                {/* The models under evaluation, in their own identities. */}
                <ul className="mt-7 flex flex-col gap-2.5">
                  {MODEL_LIST.map((model) => (
                    <li
                      key={model.id}
                      className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2"
                    >
                      <span
                        aria-hidden="true"
                        className="h-4 w-[3px] shrink-0 rounded-full"
                        style={{ backgroundColor: model.color }}
                      />
                      {model.brand ? (
                        <span className="flex h-4 items-center rounded bg-white px-1.5 py-[3px]">
                          <ModelLogo model={model.id} height={11} />
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-white">
                        {model.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Scope of the evaluation, as figures rather than prose. */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/10 pt-5">
                <Fact label="Plants" value={String(PLANT_LIST.length)} />
                <Fact label="Installed" value={`${INSTALLED_MW} MW`} />
                <Fact label="Resolution" value="15 min" />
                <Fact label="Band A" value={`${BAND_RANGE} of Actual`} />
              </dl>
            </div>

            {/* ---------- Form panel ---------- */}
            <div className="relative bg-white p-7 sm:p-9">
              {/* Tick rail, echoing the instrument edge on the workspace panels. */}
              <span aria-hidden="true" className="fx-ticks absolute inset-x-0 top-0" />

              <div className="md:hidden">
                <span className="flex items-center gap-3.5">
                  <ModelLogo model="sunsure_internal" variant="wordmark" height={13} />
                  <span aria-hidden="true" className="h-6 w-px bg-line" />
                  <ModelLogo model="nevron" variant="wordmark" height={18} />
                </span>
                <div className="mt-6 h-px bg-line" />
              </div>

              <div className="mt-6 md:mt-0">
                <p className="eyebrow">Restricted workspace</p>
                <h2 className="mt-3 text-[20px] leading-tight font-semibold tracking-[-0.018em] text-ink">
                  Enter access code
                </h2>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-3">
                  Shared with a single access code, validated on the server. It never reaches the
                  browser bundle.
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9.5px] leading-none tracking-[0.14em] text-ondark-4 uppercase">
        {label}
      </dt>
      <dd className="fx-figure mt-1.5 text-[14px] leading-none text-white">{value}</dd>
    </div>
  );
}
