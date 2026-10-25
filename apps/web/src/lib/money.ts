const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Formats integer kobo as naira, e.g. 100000 → "₦1,000". */
export function formatNaira(kobo: number): string {
  return naira.format(kobo / 100);
}

/**
 * Parses a naira amount typed by a person ("1,000" or "1000.50") into integer kobo
 * without floating-point arithmetic. Returns null when the input is not a valid amount.
 */
export function parseNairaToKobo(input: string): number | null {
  const cleaned = input.trim().replace(/[₦,\s]/g, "");
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const kobo = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return kobo > 0 ? kobo : null;
}
