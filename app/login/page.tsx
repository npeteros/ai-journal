'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signIn, type AuthActionState } from '@/app/actions/auth';

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(signIn, undefined);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <form action={action} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Log in</h1>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-foreground px-5 py-2 font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {pending ? 'Logging in…' : 'Log in'}
        </button>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No account?{' '}
          <Link href="/signup" className="font-medium text-zinc-950 dark:text-zinc-50">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
