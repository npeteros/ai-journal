'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check } from 'lucide-react'

import { signUp } from '@/src/lib/auth-client'
import { registerSchema, type RegisterValues } from '@/src/server/auth/schemas/register'
import { Button } from '@/components/ui/button'
import { Field, PasswordInput, PasswordStrength, authInputClass } from './fields'

const AFTER_REGISTER_URL = '/journal'

export function RegisterForm() {
  const router = useRouter()

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirm: '', agreed: false },
  })

  const password = useWatch({ control, name: 'password' })

  async function onSubmit({ name, email, password }: RegisterValues) {
    const { error } = await signUp.email({ email, password, name })

    if (error) return setError('root', { message: error.message ?? 'Something went wrong.' })
    router.push(AFTER_REGISTER_URL)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
      <Field id="name" label="Name" error={errors.name?.message}>
        <input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="Maya Chen"
          aria-invalid={!!errors.name}
          disabled={isSubmitting}
          className={authInputClass}
          {...register('name')}
        />
      </Field>

      <Field id="email" label="Email" error={errors.email?.message}>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          disabled={isSubmitting}
          className={authInputClass}
          {...register('email')}
        />
      </Field>

      <Field id="password" label="Password">
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          disabled={isSubmitting}
          {...register('password')}
        />
        <PasswordStrength password={password} invalid={!!errors.password} />
      </Field>

      <Field id="confirm" label="Confirm password" error={errors.confirm?.message}>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          aria-invalid={!!errors.confirm}
          disabled={isSubmitting}
          {...register('confirm')}
        />
      </Field>

      <label className="mt-1 flex items-start gap-2.5 text-[13px] leading-[1.45] text-neutral-600">
        <span className="relative mt-px flex size-[18px] shrink-0">
          <input
            type="checkbox"
            aria-invalid={!!errors.agreed}
            className="peer size-[18px] cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-neutral-300 bg-surface transition-colors checked:border-neutral-900 checked:bg-neutral-900 focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive"
            {...register('agreed')}
          />
          <Check
            className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-surface peer-checked:block"
            strokeWidth={3}
          />
        </span>
        <span>
          I agree to the{' '}
          <Link href="/terms" className="font-semibold text-cloud-700 hover:underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="font-semibold text-cloud-700 hover:underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {errors.agreed && <p className="text-[13px] text-destructive">{errors.agreed.message}</p>}

      {errors.root && (
        <p role="alert" className="text-[13px] text-destructive">
          {errors.root.message}
        </p>
      )}

      <Button
        type="submit"
        variant="ink"
        size="cta-lg"
        disabled={isSubmitting}
        className="mt-3 w-full"
      >
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="mt-2 text-center text-[13px] font-medium text-neutral-400">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-cloud-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
