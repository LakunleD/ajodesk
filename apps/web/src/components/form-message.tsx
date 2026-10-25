import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FormState } from "@/lib/errors";

export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <Alert variant={state.ok ? "default" : "destructive"} role={state.ok ? "status" : "alert"}>
      {state.ok ? <CircleCheckIcon /> : <CircleAlertIcon />}
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
