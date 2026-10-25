import Link from "next/link";
import { logout } from "@/app/actions";
import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import type { Collector } from "@/lib/types";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const collector = await apiGet<Collector>("/auth/me");
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
          <Link href="/contributors" className="font-heading text-lg font-semibold tracking-tight">
            Ajo<span className="text-primary">Desk</span>
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{collector.fullName}</span>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-6 px-4 py-8">{children}</main>
    </>
  );
}
