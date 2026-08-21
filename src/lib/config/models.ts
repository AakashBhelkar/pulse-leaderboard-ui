import type { BandCode, ModelId } from "@/lib/types";

/** Brand mark for a model, when the vendor has one. */
interface BrandAsset {
  src: string;
  width: number;
  height: number;
  /**
   * Fraction of the asset's height occupied by the vendor's name itself.
   *
   * Two lockups drawn at the same CSS height do not read as the same size when
   * one is letters alone and the other pairs letters with a tall mark and a
   * tagline. Sunsure's master lockup gives the word 47.8% of its box, so at a
   * shared height its name would render half the size of a pure wordmark beside
   * it. Callers that need optical parity divide by this instead of guessing.
   * Omitted means the asset is essentially all name.
   */
  wordFraction?: number;
}

export interface ModelBrand {
  /** Wordmark asset — wide lockup, used where there is horizontal room. */
  wordmark?: BrandAsset;
  /** Square/hex mark — used in dense rows and chips. */
  mark?: BrandAsset;
  /** Rendered as styled text when no asset has been supplied yet. */
  textLockup?: string;
}

export interface ModelMeta {
  id: ModelId;
  name: string;
  shortName: string;
  /** Locked identity colour — same in chart, table, band chart and compare. */
  color: string;
  softColor: string;
  vendor: string;
  note: string;
  brand?: ModelBrand;
}

/**
 * Model identity.
 *
 * The two models under evaluation carry their own brand colours: Nevron Blue
 * from the Nevron Group brand guide, and Sunsure's red-orange. The external QCA
 * feed is not a Nevron or Sunsure brand, so it takes a neutral graphite — which
 * also reads correctly as the incumbent baseline the two are measured against.
 *
 * Nevron Group colour rules followed here: the brand blue and green are used as
 * accents on a light ground, never as a saturated full-bleed background, and
 * text is never set on a raw accent surface.
 */
export const MODELS: Record<ModelId, ModelMeta> = {
  external_qca: {
    id: "external_qca",
    name: "External QCA",
    shortName: "QCA",
    // Not a Nevron or Sunsure brand, so it takes a colour of its own. Purple is
    // the only hue far enough from both Sunsure red-orange and Nevron blue to
    // stay separable at 1.6px — and unlike a graphite, it can never be mistaken
    // for the near-black Actual line.
    color: "#8e2da8",
    softColor: "#f6eaf9",
    vendor: "Incumbent QCA",
    note: "Forecast supplied by the external qualified coordinating agency.",
  },
  sunsure_internal: {
    id: "sunsure_internal",
    name: "Sunsure Internal",
    shortName: "Sunsure",
    // Sunsure brand red, read off the master logo artwork (#cf402d). The
    // earlier #ff3b21 was an approximation from before the asset arrived.
    color: "#cf402d",
    softColor: "#fbeae7",
    vendor: "Sunsure",
    note: "In-house forecasting model maintained by the Sunsure team.",
    brand: {
      /* Two crops of the one master lockup, tight to the ink. The mark alone
         carries dense rows and chips at 13-15px, where the full horizontal
         lockup would be too wide and its tagline illegible; the lockup goes
         where there is room to read it. */
      mark: { src: "/brand/sunsure-mark.svg", width: 1234, height: 1133 },
      wordmark: {
        src: "/brand/sunsure-lockup.svg",
        width: 4885,
        height: 1142,
        wordFraction: 0.478,
      },
    },
  },
  nevron: {
    id: "nevron",
    name: "Nevron",
    shortName: "Nevron",
    // Nevron Blue — "Primary · Trust" in the Nevron Group brand guide.
    color: "#1a5fab",
    softColor: "#e8f1fb",
    vendor: "Nevron",
    note: "Vendor model under evaluation in the current pilot.",
    brand: {
      wordmark: { src: "/brand/nevron-wordmark.png", width: 2082, height: 302 },
      mark: { src: "/brand/nevron-mark.png", width: 1763, height: 1577 },
    },
  },
};

export const MODEL_IDS: ModelId[] = [
  "external_qca",
  "sunsure_internal",
  "nevron",
];

export const MODEL_LIST = MODEL_IDS.map((id) => MODELS[id]);

/* -------------------------------------------------------------------------- */
/* Vendor brand palettes (Nevron Group brand guide v4.5)                       */
/* -------------------------------------------------------------------------- */

export const NEVRON = {
  blue: "#1a5fab",
  green: "#2db24b",
  deepBlue: "#0d3d72",
  black: "#0f1117",
  blueTint: "#e8f1fb",
  greenTint: "#e8f7ec",
} as const;

export const SUNSURE = {
  red: "#ff3b21",
  redTint: "#ffece8",
} as const;

export const ACTUAL_COLOR = "#16211d";

/** Light-green wash for the Band A band drawn around Actual. Far paler and less
 *  saturated than any model stroke, so the fill can never be mistaken for a
 *  fourth series (PRD §10.2). */
export const TOLERANCE_COLOR = "#86c79a";

export const BAND_COLORS: Record<BandCode, string> = {
  A: "#1f9d6b",
  B: "#e0a02a",
  C: "#ea8034",
  D: "#e0524f",
  E: "#a4243f",
};

/** Field on IntervalRecord that carries this model's value. */
export const MODEL_FIELD: Record<ModelId, "external_qca_mw" | "sunsure_internal_mw" | "nevron_mw"> = {
  external_qca: "external_qca_mw",
  sunsure_internal: "sunsure_internal_mw",
  nevron: "nevron_mw",
};
