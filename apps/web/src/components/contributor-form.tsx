"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { createContributor } from "@/app/actions";
import { Field } from "@/components/field";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/errors";

/** Stays open after each save so a collector can register several people in a row. */
export function ContributorForm() {
  const [state, action, pending] = useActionState(createContributor, { ok: false } as FormState);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      nameRef.current?.focus();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <FormMessage state={state} />
      {state.ok && state.created ? (
        <p className="-mt-2 text-sm">
          <Link href={`/contributors/${state.created.id}`} className="font-medium underline underline-offset-4">
            Open {state.created.label}
          </Link>{" "}
          to enroll them, or add the next person.
        </p>
      ) : null}
      <Field
        ref={nameRef}
        label="Full name"
        name="fullName"
        required
        minLength={2}
        maxLength={120}
        errors={errors.fullName}
      />
      <Field
        label="Phone (optional)"
        name="phone"
        type="tel"
        placeholder="+2348000000000"
        hint="Helps tell apart contributors who share a name."
        errors={errors.phone}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add contributor"}
      </Button>
    </form>
  );
}
