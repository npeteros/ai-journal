'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { signIn } from '@/src/lib/auth-client'
import { loginSchema, type LoginValues } from '@/src/server/auth/schemas/login'
import { Button } from '@/components/ui/button'
import { Field, PasswordInput, authInputClass } from './fields'

// Where to send the user after a successful sign in.
const AFTER_LOGIN_URL = '/journal'

export function LoginForm() {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit({ email, password }: LoginValues) {
    const { error } = await signIn.email({ email, password, callbackURL: AFTER_LOGIN_URL })

    if (error) {
      return setError('root', {
        message:
          error.status === 403
            ? 'Please verify your email address first.'
            : error.message || 'Something went wrong. Please try again.',
      })
    }

    router.push(AFTER_LOGIN_URL)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col">
      <Field id="email" label="Email" error={errors.email?.message} className="mb-3">
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          disabled={isSubmitting}
          className={authInputClass}
          {...register('email')}
        />
      </Field>

      <Field
        id="password"
        label="Password"
        error={errors.password?.message}
        aside={
          <Link
            href="/forgot-password"
            className="text-[13px] font-semibold text-cloud-700 hover:underline"
          >
            Forgot password?
          </Link>
        }
      >
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder="••••••••"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          disabled={isSubmitting}
          {...register('password')}
        />
      </Field>

      {errors.root && (
        <p role="alert" className="mt-4 text-[13px] text-destructive">
          {errors.root.message}
        </p>
      )}

      <Button
        type="submit"
        variant="ink"
        size="cta-lg"
        disabled={isSubmitting}
        className="mt-[22px] w-full"
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className="mt-[18px] text-center text-[13px] font-medium text-neutral-400">
        New here?{' '}
        <Link href="/register" className="font-semibold text-cloud-700 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  )
}
