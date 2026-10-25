"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPlan } from "@/app/actions";
import { Field } from "@/components/field";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/errors";

export function PlanForm() {
  const [state, action, pending] = useActionState(createPlan, { ok: false } as FormState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <FormMessage state={state} />
      <Field label="Name" name="name" required minLength={2} placeholder="October Daily Savings" errors={errors.name} />
      <Field
        label="Daily amount (₦)"
        name="dailyAmount"
        inputMode="decimal"
        required
        placeholder="1000"
        hint="Naira per day. Each scheduled day is paid in full."
        errors={errors.dailyAmountMinor}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" name="startOn" type="date" required errors={errors.startOn} />
        <Field label="End" name="endOn" type="date" required errors={errors.endOn} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create plan"}
      </Button>
    </form>
  );
}
