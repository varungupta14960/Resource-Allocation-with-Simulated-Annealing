export const fmt = (x: number | null | undefined, d = 2): string =>
  x === null || x === undefined || Number.isNaN(x) ? "—" : x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (x: number | null | undefined, d = 1): string => (x === null || x === undefined ? "—" : `${(x * 100).toFixed(d)}%`);
export const ms = (x: number | null | undefined): string => {
  if (x === null || x === undefined) return "—";
  if (x < 1) return `${x.toFixed(3)} ms`;
  if (x < 1000) return `${x.toFixed(1)} ms`;
  return `${(x / 1000).toFixed(2)} s`;
};
export const gapStr = (g: number | null | undefined): string => (g === null || g === undefined ? "n/a" : `${g.toFixed(3)}%`);
export const sci = (log10: number, raw: string): string => (raw.length <= 9 ? Number(raw).toLocaleString("en-US") : `≈ 10^${log10.toFixed(1)}`);
export const EXACT_UNAVAILABLE = "Exact optimum not computed for this instance.";
