import { AttestationNote } from "@/components/attestation-note";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import type { EnrollmentSummary } from "@/lib/types";

/**
 * Recorded total and due-to-date outstanding are different numbers (PRD §7);
 * both come straight from the API summary.
 */
export function SummaryCards({ summary }: { summary: EnrollmentSummary }) {
  const outstanding = summary.outstandingDueMinor;
  return (
    <section aria-label="Balance summary" className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Total recorded</CardDescription>
            <p className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
              {formatNaira(summary.recordedTotalMinor)}
            </p>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {summary.paidDaysCount} of {summary.eligibleDaysCount} days paid
            {summary.prepaidMinor > 0 ? `, including ${formatNaira(summary.prepaidMinor)} paid ahead` : ""}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Outstanding to date</CardDescription>
            <p className={`font-heading text-3xl font-semibold tracking-tight tabular-nums ${outstanding > 0 ? "text-overdue-foreground" : "text-paid-foreground"}`}>
              {formatNaira(outstanding)}
            </p>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {summary.unpaidDatesCount === 0
              ? "Nothing missed so far"
              : `${summary.unpaidDatesCount} missed ${summary.unpaidDatesCount === 1 ? "day" : "days"}`}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Due so far</CardDescription>
            <p className="font-heading text-3xl font-semibold tracking-tight tabular-nums">{formatNaira(summary.dueMinor)}</p>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {summary.dueDaysCount} days × {formatNaira(summary.dailyAmountMinor)}, up to {formatDate(summary.asOf)}
          </CardContent>
        </Card>
      </div>
      <AttestationNote />
    </section>
  );
}
