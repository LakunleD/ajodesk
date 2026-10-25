import { ShieldAlertIcon } from "lucide-react";

/** Every place that shows recorded cash says what it is: the collector's attestation. */
export function AttestationNote() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <ShieldAlertIcon className="size-3.5" aria-hidden />
      Cash amounts are recorded by the collector. They are not verified by a bank.
    </p>
  );
}
