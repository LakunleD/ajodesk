import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FieldProps extends ComponentProps<"input"> {
  label: string;
  name: string;
  hint?: string;
  errors?: string[];
}

/** Labelled input with optional hint and server-side validation messages. */
export function Field({ label, name, hint, errors, id, ...props }: FieldProps) {
  const inputId = id ?? name;
  const describedBy = errors?.length ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {errors?.length ? (
        <p id={`${inputId}-error`} className="text-sm text-destructive">
          {errors.join(" ")}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
