import Image from "next/image";
import { MODELS } from "@/lib/config/models";
import type { ModelId } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

/**
 * A model's own brand mark, where the vendor has supplied one.
 *
 * Both vendors now ship real artwork — a mark for dense rows and chips, a
 * wordmark where there is horizontal room. External QCA has no brand: it
 * renders nothing, and the caller's colour bar carries the identity instead.
 *
 * Never sits on a saturated ground, per the Nevron Group colour rules.
 */
export function ModelLogo({
  model,
  variant = "mark",
  height = 18,
  className,
}: {
  model: ModelId;
  variant?: "mark" | "wordmark";
  height?: number;
  className?: string;
}) {
  const meta = MODELS[model];
  const brand = meta.brand;
  if (!brand) return null;

  const asset = variant === "wordmark" ? brand.wordmark ?? brand.mark : brand.mark;

  if (asset) {
    /* `height` is the height the vendor's name should read at. An asset that
       surrounds its name with a tall mark or a tagline is drawn proportionally
       larger so the name still lands at that size — otherwise two logos set to
       one height look like two different sizes. */
    const boxHeight = Math.round(height / (asset.wordFraction ?? 1));
    const width = Math.round((asset.width / asset.height) * boxHeight);
    return (
      <Image
        src={asset.src}
        alt={`${meta.name} logo`}
        width={width}
        height={boxHeight}
        className={cn("shrink-0 object-contain", className)}
        style={{ height: boxHeight, width }}
        // Identity, not content: a brand mark should never pop in late, and
        // lazy loading never resolves at all in a background tab.
        loading="eager"
        unoptimized
      />
    );
  }

  if (brand.textLockup) {
    return (
      <span
        aria-label={`${meta.name} logo`}
        className={cn("shrink-0 leading-none font-bold tracking-[-0.035em] lowercase", className)}
        style={{ color: meta.color, fontSize: height * 0.95 }}
      >
        {brand.textLockup}
      </span>
    );
  }

  return null;
}

/**
 * Logo where available, colour bar where not — so every model row has an
 * identity marker of the same visual weight.
 */
export function ModelIdentity({
  model,
  height = 18,
  variant = "mark",
  className,
}: {
  model: ModelId;
  height?: number;
  variant?: "mark" | "wordmark";
  className?: string;
}) {
  const meta = MODELS[model];
  const hasBrand = Boolean(meta.brand);

  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", className)} style={{ minWidth: height + 4 }}>
      {hasBrand ? (
        <ModelLogo model={model} variant={variant} height={height} />
      ) : (
        <span
          aria-hidden="true"
          className="rounded-full"
          style={{ width: 3, height, backgroundColor: meta.color }}
        />
      )}
    </span>
  );
}

/**
 * Masthead lockup: the host brand and the vendor under evaluation, side by
 * side, on a white plate.
 *
 * The plate is not decoration. Nevron Blue on the near-black masthead measures
 * 2.80:1 — the wordmark simply vanished. On white it is 6.42:1, which is also
 * the primary ground both marks are drawn for. Sunsure sits first: it is the
 * host product, and a host brand leads.
 *
 * Sizing the two is a genuine trade-off rather than one number.
 *
 * Measured from the artwork: Nevron's lockup is tightly cropped, with its icon
 * and its letters both filling the full height. Sunsure's master lockup gives
 * its name only 47.8% of the box, because the parallelogram mark beside it runs
 * twice the height of the word. So matching the two *names* leaves Sunsure's
 * block twice as tall, and matching the two *blocks* leaves "nevron" twice the
 * size of "sunsure" — the two cannot both be satisfied.
 *
 * `height` is the name height, and NEVRON_LIFT then raises Nevron above it: far
 * enough that its block no longer reads as the junior mark, not so far that its
 * word towers over Sunsure's much heavier one. This constant is the knob — 1
 * would match the names exactly, ~2.1 would match the outer boxes.
 */
const NEVRON_LIFT = 1.4;

export function VendorLockup({
  height = 18,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-3.5 rounded-[10px] bg-white px-3.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.25)]",
        className,
      )}
    >
      <ModelLogo model="sunsure_internal" variant="wordmark" height={height} />
      <span aria-hidden="true" className="h-5 w-px bg-line-strong" />
      <ModelLogo model="nevron" variant="wordmark" height={Math.round(height * NEVRON_LIFT)} />
    </span>
  );
}
