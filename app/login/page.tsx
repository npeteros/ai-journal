import type { Metadata } from 'next'
import { Manrope, Newsreader } from 'next/font/google'
import { LoginForm } from '@/components/auth/login-form'

const currentYear = new Date().getFullYear()

const serif = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
})

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'Sign in · JADEN',
}

export default function LoginPage() {
  return (
    <main
      className={`${serif.variable} ${sans.variable} grid min-h-screen bg-[#fcf9f4] font-[family-name:var(--font-sans)] lg:grid-cols-[39%_1fr]`}
    >
      {/* Left: brand + testimonial (hidden on small screens) */}
      <aside className="hidden flex-col justify-between bg-[#1f1c17] px-[60px] py-[60px] text-[#f5efe4] lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-[33px] items-center justify-center rounded-lg bg-[#fcf9f4] text-[#1f1c17]">
            <span
              className="font-[family-name:var(--font-serif)] text-lg font-semibold"
              aria-hidden
            >
              J
            </span>
          </span>
          <span className="font-[family-name:var(--font-serif)] text-xl font-semibold tracking-wide">
            JADEN
          </span>
        </div>

        <figure>
          <span
            className="mb-3 block font-[family-name:var(--font-serif)] text-4xl leading-none text-[#b39b7a]"
            aria-hidden
          >
            “
          </span>
          <blockquote className="max-w-[440px] font-[family-name:var(--font-serif)] text-[29px] italic leading-[1.5]">
            &ldquo;Journaling with JADEN feels like having a quiet, honest conversation with
            yourself &mdash; one that actually remembers what you said last month.&rdquo;
          </blockquote>
          <figcaption className="mt-5 text-sm text-[#a39d92]">A daily user, 8 months in</figcaption>
        </figure>

        <p className="text-sm text-[#8a847a]">&copy; {currentYear} JADEN</p>
      </aside>

      {/* Right: form */}
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[392px]">
          <h1 className="font-[family-name:var(--font-serif)] text-[34px] font-medium leading-tight text-[#1f1c17]">
            Welcome back
          </h1>
          <p className="mt-2 text-[15px] text-[#7a746a]">
            Sign in to keep your journal private and synced.
          </p>

          <LoginForm />
        </div>
      </section>
    </main>
  )
}
