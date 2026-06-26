// A pure 5-field cron matcher: minute hour day-of-month month day-of-week.
// Supports `*`, lists (`a,b`), ranges (`a-b`), and steps (`*/n`, `a-b/n`).

interface Field {
  min: number;
  max: number;
}

const FIELDS: Field[] = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month
  { min: 0, max: 6 }, // day of week (0 = Sunday)
];

/** Expand one cron field token into the set of matching numbers. */
function expand(token: string, field: Field): Set<number> {
  const out = new Set<number>();
  for (const part of token.split(",")) {
    const [range, stepRaw] = part.split("/");
    const step = stepRaw ? Number(stepRaw) : 1;
    if (!Number.isInteger(step) || step < 1) throw new Error(`invalid cron step: ${part}`);

    let lo = field.min;
    let hi = field.max;
    if (range !== "*") {
      const [a, b] = range!.split("-");
      lo = Number(a);
      hi = b !== undefined ? Number(b) : lo;
      if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < field.min || hi > field.max || lo > hi) {
        throw new Error(`invalid cron field: ${part}`);
      }
    }
    for (let n = lo; n <= hi; n += step) out.add(n);
  }
  return out;
}

/** True when `date` satisfies the 5-field cron `expr`. */
export function cronMatches(expr: string, date: Date): boolean {
  const tokens = expr.trim().split(/\s+/);
  if (tokens.length !== 5) throw new Error(`cron must have 5 fields, got ${tokens.length}: "${expr}"`);

  const values = [
    date.getMinutes(),
    date.getHours(),
    date.getDate(),
    date.getMonth() + 1,
    date.getDay(),
  ];

  for (let i = 0; i < 5; i++) {
    if (!expand(tokens[i]!, FIELDS[i]!).has(values[i]!)) return false;
  }
  return true;
}
