'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { signIn } from '@/src/lib/auth-client'
import { loginSchema, type LoginValues } from '@/src/server/auth/schemas/login'

// Where to send the user after a successful sign in.
const AFTER_LOGIN_URL = '/dashboard'

const inputClass =
  'h-14 w-full rounded-2xl border border-[#e8e3d9] bg-[#fdfbf7] px-4 text-[15px] text-[#1f1c17] placeholder:text-[#a39d92] outline-none transition-colors focus:border-[#1f1c17] disabled:opacity-60'

export function LoginForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)

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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-9 space-y-5">
      {/* Email */}
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-[#5c564d]">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          disabled={isSubmitting}
          className={inputClass}
          {...register('email')}
        />
        {errors.email && <p className="text-sm text-red-700">{errors.email.message}</p>}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium text-[#5c564d]">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-[#2b3a4a] hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            disabled={isSubmitting}
            className={`${inputClass} pr-12`}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-4 flex items-center text-[#8a847a] transition-colors hover:text-[#1f1c17]"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {errors.password && <p className="text-sm text-red-700">{errors.password.message}</p>}
      </div>

      {errors.root && (
        <p role="alert" className="text-sm text-red-700">
          {errors.root.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-14 w-full rounded-2xl bg-[#1f1c17] text-[15px] font-medium text-[#fcf9f4] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="pt-1 text-center text-sm text-[#8a847a]">
        New here?{' '}
        <Link href="/register" className="font-medium text-[#2b3a4a] hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  )
}
