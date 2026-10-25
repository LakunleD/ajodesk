"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckIcon, UserPlusIcon } from "lucide-react";
import { createEnrollment } from "@/app/actions";
import { Field } from "@/components/field";
import { FormMessage } from "@/components/form-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/errors";
import { formatNaira } from "@/lib/money";
import type { Contributor, Plan } from "@/lib/types";

/**
 * Enroll from the plan side. The dialog stays open after each enrollment so a collector can
 * add a whole group to one plan; people enrolled in this session drop out of the picker.
 */
export function EnrollInPlanDialog({
  plan,
  contributors,
  alreadyEnrolledIds = [],
  triggerLabel = "Enroll",
}: {
  plan: Plan;
  contributors: Contributor[];
  /** Contributors already in the plan; left out of the picker when known. */
  alreadyEnrolledIds?: string[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [enrolled, setEnrolled] = useState<{ id: string; label: string; contributorId: string }[]>([]);
  const [state, action, pending] = useActionState(
    async (prev: FormState, form: FormData): Promise<FormState> => {
      const result = await createEnrollment(prev, form);
      const created = result.created;
      if (result.ok && created) {
        const contributorId = String(form.get("contributorId"));
        setEnrolled((list) => [...list, { ...created, contributorId }]);
      }
      return result;
    },
    { ok: false },
  );
  const errors = state.fieldErrors ?? {};
  const enrolledIds = new Set([...alreadyEnrolledIds, ...enrolled.map((e) => e.contributorId)]);
  const remaining = contributors.filter((c) => !enrolledIds.has(c.id));

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setEnrolled([]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UserPlusIcon /> {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll in {plan.name}</DialogTitle>
          <DialogDescription>
            {formatNaira(plan.dailyAmountMinor)} per day. Add as many people as you need, one after another.
          </DialogDescription>
        </DialogHeader>

        {enrolled.length > 0 ? (
          <ul className="grid gap-1 rounded-lg bg-paid/60 p-3 text-sm" aria-label="Enrolled just now">
            {enrolled.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <CheckIcon className="size-4 text-paid-foreground" aria-hidden />
                <span className="flex-1">{e.label}</span>
                <Link href={`/enrollments/${e.id}`} className="text-xs underline underline-offset-4">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {contributors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no contributors yet.{" "}
            <Link href="/contributors" className="underline underline-offset-4">
              Add a contributor
            </Link>{" "}
            first.
          </p>
        ) : remaining.length === 0 ? (
          <p className="text-sm text-muted-foreground">Everyone in your contributor list is in this plan.</p>
        ) : (
          // Remount after each success so the picker resets to "Choose a contributor…".
          <form key={enrolled.length} action={action} className="grid gap-4">
            {state.ok ? null : <FormMessage state={state} />}
            <input type="hidden" name="planId" value={plan.id} />
            <input type="hidden" name="stay" value="1" />
            <div className="grid gap-1.5">
              <Label htmlFor={`contributor-${plan.id}`}>{enrolled.length ? "Next contributor" : "Contributor"}</Label>
              <NativeSelect id={`contributor-${plan.id}`} name="contributorId" required defaultValue="">
                <option value="" disabled>
                  Choose a contributor…
                </option>
                {remaining.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">Names can repeat. Check the phone number.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                id={`start-${plan.id}`}
                label="Start"
                name="startOn"
                type="date"
                defaultValue={plan.startOn}
                min={plan.startOn}
                max={plan.endOn}
                errors={errors.startOn}
              />
              <Field
                id={`end-${plan.id}`}
                label="End"
                name="endOn"
                type="date"
                defaultValue={plan.endOn}
                min={plan.startOn}
                max={plan.endOn}
                errors={errors.endOn}
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                {enrolled.length ? "Done" : "Cancel"}
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Enrolling…" : "Enroll"}
              </Button>
            </DialogFooter>
          </form>
        )}
        {remaining.length === 0 && contributors.length > 0 ? (
          <DialogFooter>
            <DialogClose render={<Button />}>Done</DialogClose>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
