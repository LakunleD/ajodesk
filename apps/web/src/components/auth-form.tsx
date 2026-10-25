"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/app/actions";
import { Field } from "@/components/field";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/errors";

const initial: FormState = { ok: false };

export function LoginForm({ next, expired }: { next?: string; expired: boolean }) {
  const [state, action, pending] = useActionState(login, initial);
  return (
    <form action={action} className="grid gap-4">
      {expired && !state.message ? (
        <FormMessage state={{ ok: false, message: "Your session ended. Please sign in again." }} />
      ) : null}
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" name="email" type="email" autoComplete="email" required autoFocus />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New collector?{" "}
        <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, initial);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <Field label="Full name" name="fullName" autoComplete="name" required minLength={2} errors={errors.fullName} />
      <Field label="Email" name="email" type="email" autoComplete="email" required errors={errors.email} />
      <Field
        label="Phone (optional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="+2348000000000"
        errors={errors.phone}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="At least 10 characters."
        errors={errors.password}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
