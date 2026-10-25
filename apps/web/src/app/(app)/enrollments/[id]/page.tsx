import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { Schedule } from "@/components/schedule";
import { SummaryCards } from "@/components/summary-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { describeDates, formatDate, formatTimestamp, isDateOnly } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import type { Contribution, Enrollment, EnrollmentSummary, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Enrollment" };

export default async function EnrollmentPage({ params, searchParams }: PageProps<"/enrollments/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const asOf = typeof query.asOf === "string" && isDateOnly(query.asOf) ? query.asOf : undefined;
  const cursor = typeof query.cursor === "string" ? query.cursor : undefined;
  const enc = encodeURIComponent(id);

  const historyQuery = new URLSearchParams({ limit: "10" });
  if (cursor) historyQuery.set("cursor", cursor);
  const [enrollment, summary, history] = await Promise.all([
    apiGet<Enrollment>(`/enrollments/${enc}`),
    apiGet<EnrollmentSummary>(`/enrollments/${enc}/summary${asOf ? `?asOf=${asOf}` : ""}`),
    apiGet<Page<Contribution>>(`/enrollments/${enc}/contributions?${historyQuery}`),
  ]);

  return (
    <>
      <div className="grid gap-2">
        <Link href={`/contributors/${enrollment.contributor.id}`} className="text-sm text-muted-foreground hover:underline">
          ← {enrollment.contributor.fullName}
        </Link>
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              {enrollment.contributor.fullName}
              <Badge variant="secondary">{enrollment.status.toLowerCase()}</Badge>
            </span>
          }
          description={`${enrollment.plan.name} · ${formatNaira(enrollment.plan.dailyAmountMinor)} per day · ${formatDate(enrollment.startOn)} – ${formatDate(enrollment.endOn)}`}
          action={
            <form className="flex items-end gap-2" aria-label="View balance as of a date">
              <label className="grid gap-1 text-xs text-muted-foreground">
                As of
                <Input
                  type="date"
                  name="asOf"
                  defaultValue={summary.asOf}
                  min={enrollment.startOn}
                  className="w-auto"
                />
              </label>
              <Button type="submit" variant="outline">
                View
              </Button>
              {asOf ? (
                <Button variant="ghost" nativeButton={false} render={<Link href={`/enrollments/${enrollment.id}`} />}>
                  Today
                </Button>
              ) : null}
            </form>
          }
        />
      </div>

      <SummaryCards summary={summary} />
      {enrollment.status === "ACTIVE" && enrollment.plan.status === "ACTIVE" ? (
        <Schedule key={summary.asOf} summary={summary} />
      ) : (
        <EmptyState title="This enrollment is closed">New cash can&apos;t be recorded against it.</EmptyState>
      )}

      <section aria-labelledby="history-heading" className="grid gap-3">
        <h2 id="history-heading" className="font-heading font-medium">
          History
        </h2>
        {history.items.length === 0 ? (
          <EmptyState title="No cash recorded yet">Recorded payments will appear here.</EmptyState>
        ) : (
          <Card size="sm">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Recorded</TableHead>
                    <TableHead>Days covered</TableHead>
                    <TableHead className="hidden sm:table-cell">Recorded by</TableHead>
                    <TableHead className="pr-4 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.items.map((contribution) => (
                    <TableRow key={contribution.id}>
                      <TableCell className="pl-4">
                        <span className="block">{formatTimestamp(contribution.createdAt)}</span>
                        <span className="font-mono text-[0.65rem] text-muted-foreground">
                          {contribution.id.slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-64 whitespace-normal">
                        {describeDates(contribution.scheduledDates)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">
                          {contribution.recordedBy.type === "INTEGRATION" ? "Integration" : "Dashboard"}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4 text-right font-medium tabular-nums">
                        {formatNaira(contribution.amountMinor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        <Pager
          basePath={`/enrollments/${enrollment.id}`}
          params={{ asOf }}
          cursor={cursor}
          nextCursor={history.nextCursor}
        />
      </section>
    </>
  );
}
