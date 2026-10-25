import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Cursor pagination: "first page" and "next page" only (the API is forward-only). */
export function Pager({
  basePath,
  params,
  cursor,
  nextCursor,
  cursorParam = "cursor",
}: {
  basePath: string;
  params?: Record<string, string | undefined>;
  cursor?: string;
  nextCursor: string | null;
  cursorParam?: string;
}) {
  if (!cursor && !nextCursor) return null;
  const href = (c?: string) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) if (value) query.set(key, value);
    if (c) query.set(cursorParam, c);
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <div className="flex justify-end gap-2">
      {cursor ? (
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href()} />}>
          First page
        </Button>
      ) : null}
      {nextCursor ? (
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href(nextCursor)} />}>
          Next page
        </Button>
      ) : null}
    </div>
  );
}
