'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
// import { authClient } from "@/lib/auth-client";

const serif = 'font-[family-name:var(--font-serif)]'

function getStrength(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (/[0-9]/.test(pw)) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const strength = getStrength(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8 || !/[0-9]/.test(password)) {
      return setError('Password must be at least 8 characters, including a number.')
    }
    if (password !== confirm) return setError("Passwords don't match.")
    if (!agreed) return setError('Please agree to the Terms and Privacy Policy.')

    setLoading(true)
    /*   const { error } = await authClient.signUp.email({
      email,
      password,
      name: email.split("@")[0],
  }); */
    setLoading(false)

    //  if (error) return setError(error.message ?? "Something went wrong.");
    router.push('/')
  }

  const input =
    'w-full rounded-xl border border-[#e5e2dc] bg-white px-5 py-4 text-[#1f1c16] outline-none focus:border-[#1f1c16]'

  return (
    <main className="grid min-h-screen lg:grid-cols-[39%_61%]">
      <aside className="hidden flex-col justify-between bg-[#1f1c16] p-[70px] text-white lg:flex">
        <div className={`flex items-center gap-3 text-xl font-semibold ${serif}`}>
          <span className="grid h-[38px] w-[38px] place-items-center rounded-[10px] bg-white">
            <span className="h-3.5 w-3.5 rounded-[3px] border-2 border-[#1f1c16]" />
          </span>
          JADEN
        </div>

        <div>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#a89b84" className="mb-6">
            <path d="M7 7h4v4c0 3-1.5 5-4 6v-2c1-.6 1.5-1.5 1.5-3H7V7zm8 0h4v4c0 3-1.5 5-4 6v-2c1-.6 1.5-1.5 1.5-3H15V7z" />
          </svg>
          <p className={`text-[28px] italic leading-[1.5] ${serif}`}>
            "Journaling with JADEN feels like having a quiet, honest conversation with yourself —
            one that actually remembers what you said last month."
          </p>
          <p className="mt-5 text-[15px] text-white/50">A daily user, 8 months in</p>
        </div>

        <p className="text-[15px] text-white/40">© 2026 JADEN</p>
      </aside>

      <section className="flex items-center justify-center bg-[#fcfaf6] px-6">
        <form onSubmit={handleSubmit} className="w-full max-w-[450px]">
          <h1 className={`text-[38px] leading-tight text-[#1f1c16] ${serif}`}>
            Create your account
          </h1>
          <p className="mt-3 text-base text-[#6b6862]">
            Start a private journal that grows with you.
          </p>

          <label htmlFor="email" className="mt-10 block text-sm font-medium text-[#1f1c16]">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maya@example.com"
            className={`mt-2 ${input}`}
          />

          <label htmlFor="password" className="mt-6 block text-sm font-medium text-[#1f1c16]">
            Password
          </label>
          <div className="relative mt-2">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${input} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8a867e]"
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>

          <div className="mt-3 flex gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i <= strength ? 'bg-[#5f8f6e]' : 'bg-[#e5e2dc]'}`}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-[#6b6862]">
            {strength > 0 && `${strengthLabel[strength]} — `}at least 8 characters, including a
            number.
          </p>

          <label htmlFor="confirm" className="mt-5 block text-sm font-medium text-[#1f1c16]">
            Confirm password
          </label>
          <input
            id="confirm"
            type={showPassword ? 'text' : 'password'}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`mt-2 ${input}`}
          />

          <label className="mt-6 flex items-center gap-3 text-sm text-[#6b6862]">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="h-5 w-5 rounded accent-[#1f1c16]"
            />
            <span>
              I agree to the{' '}
              <Link href="/terms" className="font-medium text-[#1f3a5f]">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="font-medium text-[#1f3a5f]">
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-8 w-full rounded-xl bg-[#1f1c16] py-4 text-base font-medium text-white disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <p className="mt-6 text-center text-[15px] text-[#8a867e]">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-[#1f3a5f]">
              Sign in
            </Link>
          </p>
        </form>
      </section>
    </main>
  )
}
