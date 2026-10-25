"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckIcon, CircleCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { recordCash, type RecordCashState } from "@/app/actions";
import { AttestationNote } from "@/components/attestation-note";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dateRange, formatDate, formatShortDate } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import type { EnrollmentSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type DayStatus = "paid" | "missed" | "upcoming";

/**
 * Day-by-day schedule. Status comes from the API summary (`paidDates`, `unpaidDates`);
 * the collector selects unpaid days, confirms the total, and the API posts the record.
 */
export function Schedule({ summary }: { summary: EnrollmentSummary }) {
  const days = useMemo(() => {
    const paid = new Set(summary.paidDates);
    const missed = new Set(summary.unpaidDates);
    return dateRange(summary.startOn, summary.endOn).map((date) => ({
      date,
      status: (paid.has(date) ? "paid" : missed.has(date) ? "missed" : "upcoming") as DayStatus,
    }));
  }, [summary]);

  const [picked, setPicked] = useState<string[]>([]);
  // A refreshed summary may show some picked days as paid; never carry those forward.
  const selected = picked.filter((date) => !summary.paidDates.includes(date));
  const [open, setOpen] = useState(false);
  // One key per confirmation dialog: a resubmit after a timeout replays instead of double-posting.
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [resultShownFor, setResultShownFor] = useState<string | null>(null);
  const [state, action, pending] = useActionState(
    async (prev: RecordCashState, form: FormData): Promise<RecordCashState> => {
      const result = await recordCash(prev, form);
      if (result.ok && result.contribution) {
        setPicked([]);
        toast.success(`Recorded ${formatNaira(result.contribution.amountMinor)} for ${summary.contributorName}`);
      }
      return result;
    },
    { ok: false },
  );

  const selectedSorted = [...selected].sort();
  const totalMinor = summary.dailyAmountMinor * selected.length;
  const recorded = state.ok && state.contribution && state.contribution.id !== resultShownFor ? state.contribution : null;

  function toggle(date: string) {
    setPicked((current) => (current.includes(date) ? current.filter((d) => d !== date) : [...current, date]));
  }

  function openConfirm() {
    setIdempotencyKey(crypto.randomUUID());
    setResultShownFor(null);
    setOpen(true);
  }

  function closeDialog(next: boolean) {
    setOpen(next);
    if (!next && state.contribution) setResultShownFor(state.contribution.id);
  }

  const missedCount = days.filter((d) => d.status === "missed").length;

  return (
    <section aria-labelledby="schedule-heading" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="schedule-heading" className="font-heading font-medium">
          Schedule
        </h2>
        <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-paid ring-1 ring-paid-foreground/30" /> Paid
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-overdue ring-1 ring-overdue-foreground/30" /> Missed
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm ring-1 ring-border" /> Upcoming
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
        {days.map(({ date, status }) => {
          const isSelected = selected.includes(date);
          const label = `${formatDate(date)}: ${status}${isSelected ? ", selected" : ""}`;
          if (status === "paid") {
            return (
              <div
                key={date}
                aria-label={label}
                className="flex h-14 flex-col items-center justify-center rounded-lg bg-paid text-paid-foreground"
              >
                <span className="text-xs">{formatShortDate(date)}</span>
                <CheckIcon className="size-4" aria-hidden />
              </div>
            );
          }
          return (
            <button
              key={date}
              type="button"
              aria-pressed={isSelected}
              aria-label={label}
              onClick={() => toggle(date)}
              className={cn(
                "flex h-14 flex-col items-center justify-center rounded-lg text-xs ring-1 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                isSelected
                  ? "bg-primary font-medium text-primary-foreground ring-primary"
                  : status === "missed"
                    ? "bg-overdue text-overdue-foreground ring-overdue-foreground/30 hover:ring-overdue-foreground"
                    : "ring-border hover:bg-muted",
              )}
            >
              <span>{formatShortDate(date)}</span>
              <span className="text-[0.65rem] opacity-80">{isSelected ? "selected" : status}</span>
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
        <p className="text-sm">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">
              {missedCount > 0
                ? `Select the days being paid. ${missedCount} missed ${missedCount === 1 ? "day is" : "days are"} highlighted.`
                : "Select the days being paid."}
            </span>
          ) : (
            <>
              <span className="font-medium">
                {selected.length} {selected.length === 1 ? "day" : "days"}
              </span>{" "}
              × {formatNaira(summary.dailyAmountMinor)} ={" "}
              <span className="font-heading text-lg font-semibold tabular-nums">{formatNaira(totalMinor)}</span>
            </>
          )}
        </p>
        <div className="flex gap-2">
          {selected.length > 0 ? (
            <Button variant="ghost" onClick={() => setPicked([])}>
              Clear
            </Button>
          ) : null}
          <Button size="lg" disabled={selected.length === 0} onClick={openConfirm}>
            Record cash…
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-md">
          {recorded ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CircleCheckIcon className="size-5 text-paid-foreground" aria-hidden /> Cash recorded
                </DialogTitle>
                <DialogDescription>
                  {formatNaira(recorded.amountMinor)} from {summary.contributorName} for{" "}
                  {recorded.scheduledDates.length} {recorded.scheduledDates.length === 1 ? "day" : "days"}.
                </DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="font-mono text-xs break-all">{recorded.id}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>Posted · collector-attested</dd>
              </dl>
              <DialogFooter>
                <DialogClose render={<Button />}>Done</DialogClose>
              </DialogFooter>
            </>
          ) : (
            <form action={action} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>Confirm cash received</DialogTitle>
                <DialogDescription>Check the details before you record. A posted record can&apos;t be edited.</DialogDescription>
              </DialogHeader>
              <FormMessage state={state} />
              <input type="hidden" name="enrollmentId" value={summary.enrollmentId} />
              <input type="hidden" name="amountMinor" value={totalMinor} />
              <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
              {selectedSorted.map((date) => (
                <input key={date} type="hidden" name="scheduledDates" value={date} />
              ))}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Contributor</dt>
                <dd className="font-medium">{summary.contributorName}</dd>
                <dt className="text-muted-foreground">Plan</dt>
                <dd>{summary.planName}</dd>
                <dt className="text-muted-foreground">Days</dt>
                <dd>
                  <ul className="grid gap-0.5">
                    {selectedSorted.map((date) => (
                      <li key={date}>{formatDate(date)}</li>
                    ))}
                  </ul>
                </dd>
                <dt className="text-muted-foreground">Method</dt>
                <dd>Cash</dd>
                <dt className="self-center text-muted-foreground">Amount</dt>
                <dd className="font-heading text-2xl font-semibold tabular-nums">{formatNaira(totalMinor)}</dd>
              </dl>
              <AttestationNote />
              <DialogFooter>
                <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
                <Button type="submit" disabled={pending}>
                  {pending ? "Recording…" : `Record ${formatNaira(totalMinor)}`}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
