"use client";

import { useActionState, useState } from "react";
import { createEnrollment } from "@/app/actions";
import { Field } from "@/components/field";
import { FormMessage } from "@/components/form-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/errors";
import { formatNaira } from "@/lib/money";
import type { Plan } from "@/lib/types";

export function EnrollForm({ contributorId, plans }: { contributorId: string; plans: Plan[] }) {
  const [state, action, pending] = useActionState(createEnrollment, { ok: false } as FormState);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const plan = plans.find((p) => p.id === planId);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="contributorId" value={contributorId} />
      <div className="grid gap-1.5">
        <Label htmlFor="planId">Plan</Label>
        <NativeSelect id="planId" name="planId" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {formatNaira(p.dailyAmountMinor)}/day
            </option>
          ))}
        </NativeSelect>
      </div>
      {plan ? (
        <div className="grid grid-cols-2 gap-3">
          <Field
            key={`start-${plan.id}`}
            label="Start"
            name="startOn"
            type="date"
            defaultValue={plan.startOn}
            min={plan.startOn}
            max={plan.endOn}
            errors={errors.startOn}
          />
          <Field
            key={`end-${plan.id}`}
            label="End"
            name="endOn"
            type="date"
            defaultValue={plan.endOn}
            min={plan.startOn}
            max={plan.endOn}
            errors={errors.endOn}
          />
        </div>
      ) : null}
      <Button type="submit" disabled={pending || !plan}>
        {pending ? "Enrolling…" : "Enroll"}
      </Button>
    </form>
  );
}
