import { cn } from "@/lib/utils/cn";

/** Sun-over-array mark. Drawn inline so it inherits colour and stays crisp. */
export function SunMark({
  size = 30,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sun-core" x1="10" y1="6" x2="30" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F7CD7C" />
          <stop offset="1" stopColor="#E0A02A" />
        </linearGradient>
      </defs>
      <circle
        cx="20"
        cy="20"
        r="19.25"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1.5"
      />
      {/* rays */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        const r1 = 11.6;
        const r2 = 15.2;
        return (
          <line
            key={i}
            x1={20 + Math.cos(a) * r1}
            y1={20 + Math.sin(a) * r1}
            x2={20 + Math.cos(a) * r2}
            y2={20 + Math.sin(a) * r2}
            stroke="#F0B544"
            strokeWidth="1.9"
            strokeLinecap="round"
            opacity={i % 2 === 0 ? 1 : 0.55}
          />
        );
      })}
      <circle cx="20" cy="20" r="8.4" fill="url(#sun-core)" />
      {/* array rows crossing the disc */}
      <path
        d="M11.9 22.6h16.2M13.4 26.1h13.2"
        stroke="#0C2A20"
        strokeOpacity="0.55"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandLockup({
  className,
  tone = "light",
}: {
  className?: string;
  /** `light` = placed on the deep-green masthead; `dark` = placed on paper. */
  tone?: "light" | "dark";
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <SunMark size={32} className={tone === "light" ? "text-white" : "text-brand-900"} />
      <div className="leading-none">
        <div
          className={cn(
            "text-[13px] font-semibold tracking-[0.14em] uppercase",
            tone === "light" ? "text-white" : "text-brand-900",
          )}
        >
          Solar Forecast
        </div>
        <div
          className={cn(
            "mt-[3px] text-[11px] tracking-[0.06em]",
            tone === "light" ? "text-ondark-3" : "text-ink-3",
          )}
        >
          Model Leaderboard
        </div>
      </div>
    </div>
  );
}
