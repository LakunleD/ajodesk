import Link from "next/link";
import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <EmptyState title="Record not found">
      It may not exist, or it belongs to another collector.{" "}
      <Link href="/contributors" className="underline underline-offset-4">
        Back to contributors
      </Link>
    </EmptyState>
  );
}
