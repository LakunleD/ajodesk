import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { EnrollInPlanDialog } from "@/components/enroll-in-plan-dialog";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { PlanForm } from "@/components/plan-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import type { Contributor, Page, Plan } from "@/lib/types";

export const metadata: Metadata = { title: "Plans" };

export default async function PlansPage({ searchParams }: PageProps<"/plans">) {
  const params = await searchParams;
  const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);
  const [page, contributors] = await Promise.all([
    apiGet<Page<Plan>>(`/plans?${query}`),
    apiGet<Page<Contributor>>("/contributors?limit=100"),
  ]);
  const activeContributors = contributors.items.filter((c) => c.status === "ACTIVE");

  return (
    <>
      <PageHeader
        title="Plans"
        description="Fixed daily amounts in naira over a set period. Open a plan to see its contributors and payments."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="grid content-start gap-4">
          {page.items.length === 0 ? (
            <EmptyState title="No plans yet">Create a daily plan, then enroll contributors in it.</EmptyState>
          ) : (
            <Card size="sm">
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Plan</TableHead>
                      <TableHead className="text-right">Per day</TableHead>
                      <TableHead className="hidden sm:table-cell">Period</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                      <TableHead className="pr-4 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.items.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="pl-4 font-medium">
                          <Link href={`/plans/${plan.id}`} className="hover:underline">
                            {plan.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNaira(plan.dailyAmountMinor)}</TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {formatDate(plan.startOn)} – {formatDate(plan.endOn)} · {plan.totalDays} days
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={plan.status === "ACTIVE" ? "secondary" : "outline"}>
                            {plan.status.toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          {plan.status === "ACTIVE" ? (
                            <EnrollInPlanDialog plan={plan} contributors={activeContributors} />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          <Pager basePath="/plans" cursor={cursor} nextCursor={page.nextCursor} />
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>New plan</CardTitle>
          </CardHeader>
          <CardContent>
            <PlanForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
