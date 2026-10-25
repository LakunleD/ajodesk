"use client";

import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>Something went wrong loading this page</AlertTitle>
      <AlertDescription className="grid gap-3">
        <p>No changes were made. Check that the AjoDesk API is running, then try again.</p>
        {error.digest ? <p className="text-xs">Reference: {error.digest}</p> : null}
        <div>
          <Button variant="outline" size="sm" onClick={reset}>
            Try again
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
