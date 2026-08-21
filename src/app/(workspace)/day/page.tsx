import { redirect } from "next/navigation";

/**
 * Day detail was merged into the plant monitor, which now holds the scope
 * control and the block table it used to own. This redirect keeps existing
 * links working — the fleet drill-down, anything bookmarked, anything pasted
 * into a message — by forwarding the query string untouched, so the plant,
 * period, scenario and `date` all survive the hop.
 */
export default async function DayDetailRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) query.set(key, value[0]);
  }
  const search = query.toString();
  redirect(search ? `/monitor?${search}` : "/monitor");
}
