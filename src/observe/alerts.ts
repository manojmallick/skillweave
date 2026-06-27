// OBSERVE — alerting rules. Evaluate metric thresholds into fired alerts; a host
// routes them (e.g. through the EventBus). Pure, no network.

export type AlertOp = ">" | ">=" | "<" | "<=" | "==" | "!=";
export type AlertSeverity = "info" | "warning" | "alert" | "failure";

export interface AlertRule {
  id: string;
  metric: string;
  op: AlertOp;
  threshold: number;
  severity?: AlertSeverity;
}

export interface Alert {
  id: string;
  metric: string;
  value: number;
  op: AlertOp;
  threshold: number;
  severity: AlertSeverity;
}

function compare(value: number, op: AlertOp, threshold: number): boolean {
  switch (op) {
    case ">": return value > threshold;
    case ">=": return value >= threshold;
    case "<": return value < threshold;
    case "<=": return value <= threshold;
    case "==": return value === threshold;
    case "!=": return value !== threshold;
  }
}

/** Fire the rules whose metric is present and whose comparison holds. */
export function checkAlerts(metrics: Record<string, number>, rules: AlertRule[]): Alert[] {
  const fired: Alert[] = [];
  for (const rule of rules) {
    const value = metrics[rule.metric];
    if (value == null) continue;
    if (compare(value, rule.op, rule.threshold)) {
      fired.push({
        id: rule.id,
        metric: rule.metric,
        value,
        op: rule.op,
        threshold: rule.threshold,
        severity: rule.severity ?? "warning",
      });
    }
  }
  return fired;
}
