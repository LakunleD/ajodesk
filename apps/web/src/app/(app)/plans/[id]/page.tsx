import type { Metadata } from "next";
import Link from "next/link";
import { AttestationNote } from "@/components/attestation-note";
import { EmptyState } from "@/components/empty-state";
import { EnrollInPlanDialog } from "@/components/enroll-in-plan-dialog";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { describeDates, formatDate, formatTimestamp, isDateOnly } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import type { Contributor, Page, Plan, PlanContribution, PlanMember, PlanSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage({ params, searchParams }: PageProps<"/plans/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const asOf = typeof query.asOf === "string" && isDateOnly(query.asOf) ? query.asOf : undefined;
  const membersCursor = typeof query.members === "string" ? query.members : undefined;
  const historyCursor = typeof query.history === "string" ? query.history : undefined;
  const enc = encodeURIComponent(id);

  const membersQuery = new URLSearchParams({ limit: "20" });
  if (asOf) membersQuery.set("asOf", asOf);
  if (membersCursor) membersQuery.set("cursor", membersCursor);
  const historyQuery = new URLSearchParams({ limit: "15" });
  if (historyCursor) historyQuery.set("cursor", historyCursor);

  const [plan, totals, members, history, contributors, allMembers] = await Promise.all([
    apiGet<Plan>(`/plans/${enc}`),
    apiGet<PlanSummary>(`/plans/${enc}/summary${asOf ? `?asOf=${asOf}` : ""}`),
    apiGet<Page<PlanMember>>(`/plans/${enc}/enrollments?${membersQuery}`),
    apiGet<Page<PlanContribution>>(`/plans/${enc}/contributions?${historyQuery}`),
    apiGet<Page<Contributor>>("/contributors?limit=100"),
    // For the enroll picker only: who is already in the plan.
    apiGet<Page<PlanMember>>(`/plans/${enc}/enrollments?limit=100`),
  ]);
  const activeContributors = contributors.items.filter((c) => c.status === "ACTIVE");
  const basePath = `/plans/${plan.id}`;

  return (
    <>
      <div className="grid gap-2">
        <Link href="/plans" className="text-sm text-muted-foreground hover:underline">
          ← Plans
        </Link>
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              {plan.name}
              <Badge variant="secondary">{plan.status.toLowerCase()}</Badge>
            </span>
          }
          description={`${formatNaira(plan.dailyAmountMinor)} per day · ${formatDate(plan.startOn)} – ${formatDate(plan.endOn)} · ${plan.totalDays} days`}
          action={
            <div className="flex flex-wrap items-end gap-2">
              <form className="flex items-end gap-2" aria-label="View balances as of a date">
                <label className="grid gap-1 text-xs text-muted-foreground">
                  As of
                  <Input type="date" name="asOf" defaultValue={totals.asOf} className="w-auto" />
                </label>
                <Button type="submit" variant="outline">
                  View
                </Button>
                {asOf ? (
                  <Button variant="ghost" nativeButton={false} render={<Link href={basePath} />}>
                    Today
                  </Button>
                ) : null}
              </form>
              {plan.status === "ACTIVE" ? (
                <EnrollInPlanDialog
                  plan={plan}
                  contributors={activeContributors}
                  alreadyEnrolledIds={allMembers.items.map((m) => m.contributor.id)}
                  triggerLabel="Enroll contributors"
                />
              ) : null}
            </div>
          }
        />
      </div>

      <section aria-label="Plan totals" className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Contributors" value={String(totals.enrollmentsCount)}>
            {totals.activeEnrollmentsCount} active
          </Stat>
          <Stat label="Total recorded" value={formatNaira(totals.recordedTotalMinor)}>
            {totals.prepaidMinor > 0 ? `${formatNaira(totals.prepaidMinor)} paid ahead` : "All contributors combined"}
          </Stat>
          <Stat
            label="Outstanding to date"
            value={formatNaira(totals.outstandingDueMinor)}
            tone={totals.outstandingDueMinor > 0 ? "overdue" : "paid"}
          >
            {totals.missedDaysCount} missed days across {totals.enrollmentsWithMissedDaysCount}{" "}
            {totals.enrollmentsWithMissedDaysCount === 1 ? "person" : "people"}
          </Stat>
          <Stat label="Due so far" value={formatNaira(totals.dueMinor)}>
            Up to {formatDate(totals.asOf)}
          </Stat>
        </div>
        <AttestationNote />
      </section>

      <section aria-labelledby="members-heading" className="grid gap-3">
        <h2 id="members-heading" className="font-heading font-medium">
          Contributors in this plan
        </h2>
        {members.items.length === 0 ? (
          <EmptyState title="No one is enrolled yet">Use “Enroll contributors” to add people to this plan.</EmptyState>
        ) : (
          <Card size="sm">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Contributor</TableHead>
                    <TableHead className="hidden md:table-cell">Days paid</TableHead>
                    <TableHead className="text-right">Recorded</TableHead>
                    <TableHead className="pr-4 text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.items.map((m) => (
                    <TableRow key={m.enrollmentId}>
                      <TableCell className="pl-4">
                        <Link href={`/enrollments/${m.enrollmentId}`} className="font-medium hover:underline">
                          {m.contributor.fullName}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {m.contributor.phone ?? "No phone"}
                          {m.status !== "ACTIVE" ? ` · ${m.status.toLowerCase()}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {m.summary.paidDaysCount} of {m.summary.eligibleDaysCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNaira(m.summary.recordedTotalMinor)}</TableCell>
                      <TableCell className="pr-4 text-right">
                        {m.summary.outstandingDueMinor > 0 ? (
                          <span className="font-medium text-overdue-foreground tabular-nums">
                            {formatNaira(m.summary.outstandingDueMinor)}
                            <span className="block text-xs font-normal">
                              {m.summary.unpaidDatesCount} missed {m.summary.unpaidDatesCount === 1 ? "day" : "days"}
                            </span>
                          </span>
                        ) : (
                          <span className="text-paid-foreground">Up to date</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        <Pager
          basePath={basePath}
          params={{ asOf, history: historyCursor }}
          cursor={membersCursor}
          nextCursor={members.nextCursor}
          cursorParam="members"
        />
      </section>

      <section aria-labelledby="plan-history-heading" className="grid gap-3">
        <h2 id="plan-history-heading" className="font-heading font-medium">
          All contributions
        </h2>
        {history.items.length === 0 ? (
          <EmptyState title="No cash recorded in this plan yet">
            Payments recorded for any contributor in this plan will appear here.
          </EmptyState>
        ) : (
          <Card size="sm">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Recorded</TableHead>
                    <TableHead>Contributor</TableHead>
                    <TableHead className="hidden md:table-cell">Days covered</TableHead>
                    <TableHead className="pr-4 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="pl-4">
                        <span className="block">{formatTimestamp(c.createdAt)}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.recordedBy.type === "INTEGRATION" ? "Integration" : "Dashboard"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/enrollments/${c.enrollmentId}`} className="hover:underline">
                          {c.contributor.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden max-w-64 whitespace-normal md:table-cell">
                        {describeDates(c.scheduledDates)}
                      </TableCell>
                      <TableCell className="pr-4 text-right font-medium tabular-nums">{formatNaira(c.amountMinor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        <Pager
          basePath={basePath}
          params={{ asOf, members: membersCursor }}
          cursor={historyCursor}
          nextCursor={history.nextCursor}
          cursorParam="history"
        />
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: string;
  tone?: "paid" | "overdue";
  children?: React.ReactNode;
}) {
  const toneClass = tone === "overdue" ? "text-overdue-foreground" : tone === "paid" ? "text-paid-foreground" : "";
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <p className={`font-heading text-2xl font-semibold tracking-tight tabular-nums ${toneClass}`}>{value}</p>
      </CardHeader>
      {children ? <CardContent className="text-xs text-muted-foreground">{children}</CardContent> : null}
    </Card>
  );
}
