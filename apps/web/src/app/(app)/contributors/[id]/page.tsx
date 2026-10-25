import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { EnrollForm } from "@/components/enroll-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import type { ContributorDetail, Page, Plan } from "@/lib/types";

export const metadata: Metadata = { title: "Contributor" };

export default async function ContributorPage({ params }: PageProps<"/contributors/[id]">) {
  const { id } = await params;
  const [contributor, plans] = await Promise.all([
    apiGet<ContributorDetail>(`/contributors/${encodeURIComponent(id)}`),
    apiGet<Page<Plan>>("/plans?limit=100"),
  ]);
  const enrolledPlanIds = new Set(contributor.enrollments.map((e) => e.planId));
  const availablePlans = plans.items.filter((p) => p.status === "ACTIVE" && !enrolledPlanIds.has(p.id));

  return (
    <>
      <PageHeader
        title={contributor.fullName}
        description={
          <span className="flex items-center gap-2">
            {contributor.phone ?? "No phone on file"}
            <Badge variant="secondary">{contributor.status.toLowerCase()}</Badge>
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section aria-labelledby="enrollments-heading" className="grid content-start gap-3">
          <h2 id="enrollments-heading" className="font-heading font-medium">
            Enrollments
          </h2>
          {contributor.enrollments.length === 0 ? (
            <EmptyState title="Not enrolled in any plan">Enroll them in a plan to start recording cash.</EmptyState>
          ) : (
            <ul className="grid gap-2">
              {contributor.enrollments.map((enrollment) => (
                <li key={enrollment.id}>
                  <Link
                    href={`/enrollments/${enrollment.id}`}
                    className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="grid flex-1 gap-0.5">
                      <span className="font-medium">{enrollment.planName}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(enrollment.startOn)} – {formatDate(enrollment.endOn)}
                      </span>
                    </div>
                    <span className="text-right">
                      <span className="block font-heading text-lg font-semibold tabular-nums">
                        {formatNaira(enrollment.dailyAmountMinor)}
                      </span>
                      <span className="text-xs text-muted-foreground">per day</span>
                    </span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Enroll in a plan</CardTitle>
            {availablePlans.length === 0 ? (
              <CardDescription className="grid gap-3">
                <span>
                  {plans.items.some((p) => p.status === "ACTIVE")
                    ? `${contributor.fullName} is already enrolled in every active plan. Create a new plan to enroll them again.`
                    : "You don't have any active plans yet. Create a plan, then enroll contributors in it."}
                </span>
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/plans" />}>
                  Create a plan
                </Button>
              </CardDescription>
            ) : (
              <CardDescription>Choose a plan to start recording this contributor&apos;s daily cash.</CardDescription>
            )}
          </CardHeader>
          {availablePlans.length > 0 ? (
            <CardContent>
              <EnrollForm contributorId={contributor.id} plans={availablePlans} />
            </CardContent>
          ) : null}
        </Card>
      </div>
    </>
  );
}
