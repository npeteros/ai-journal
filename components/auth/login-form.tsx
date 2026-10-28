'use client'

import { useState } from 'react'
import Link from 'next/link'

// Where to send the user after a successful sign in.
const _AFTER_LOGIN_URL = '/dashboard'

const inputClass =
  'h-14 w-full rounded-2xl border border-[#e8e3d9] bg-[#fdfbf7] px-4 text-[15px] text-[#1f1c17] placeholder:text-[#a39d92] outline-none transition-colors focus:border-[#1f1c17] disabled:opacity-60'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, _setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    // TODO: Replace this with your own authentication logic.
  }

  return (
    <form onSubmit={handleSubmit} className="mt-9 space-y-5">
      {/* Email */}
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-[#5c564d]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className={inputClass}
        />
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
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className={`${inputClass} pr-12`}
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
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="h-14 w-full rounded-2xl bg-[#1f1c17] text-[15px] font-medium text-[#fcf9f4] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Signing in…' : 'Sign in'}
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
