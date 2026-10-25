import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { ContributorForm } from "@/components/contributor-form";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { formatTimestamp } from "@/lib/dates";
import type { Contributor, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Contributors" };

export default async function ContributorsPage({ searchParams }: PageProps<"/contributors">) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const cursor = typeof params.cursor === "string" ? params.cursor : undefined;

  const query = new URLSearchParams({ limit: "20" });
  if (search) query.set("search", search);
  if (cursor) query.set("cursor", cursor);
  const page = await apiGet<Page<Contributor>>(`/contributors?${query}`);

  return (
    <>
      <PageHeader title="Contributors" description="Search by name or phone. Names are not unique." />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="grid content-start gap-4">
          <form role="search" className="flex gap-2">
            <label htmlFor="search" className="sr-only">
              Search contributors
            </label>
            <Input id="search" name="search" defaultValue={search} placeholder="e.g. Amina or 0803…" />
            <Button type="submit" variant="outline">
              <SearchIcon /> Search
            </Button>
          </form>

          {page.items.length === 0 ? (
            <EmptyState title={search ? `No contributors match “${search}”` : "No contributors yet"}>
              {search ? "Check the spelling or search by phone number." : "Add your first contributor to get started."}
            </EmptyState>
          ) : (
            <Card size="sm">
              <CardContent className="px-0">
                {search && page.items.length > 1 ? (
                  <p className="px-4 pb-2 text-sm text-muted-foreground">
                    {page.items.length}
                    {page.nextCursor ? "+" : ""} matches. Check the phone number before you continue.
                  </p>
                ) : null}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="hidden sm:table-cell">Added</TableHead>
                      <TableHead className="pr-4 text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.items.map((contributor) => (
                      <TableRow key={contributor.id}>
                        <TableCell className="pl-4 font-medium">
                          <Link href={`/contributors/${contributor.id}`} className="hover:underline">
                            {contributor.fullName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{contributor.phone ?? "—"}</TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {formatTimestamp(contributor.createdAt)}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <Badge variant={contributor.status === "ACTIVE" ? "secondary" : "outline"}>
                            {contributor.status.toLowerCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          <Pager basePath="/contributors" params={{ search }} cursor={cursor} nextCursor={page.nextCursor} />
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>New contributor</CardTitle>
          </CardHeader>
          <CardContent>
            <ContributorForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
