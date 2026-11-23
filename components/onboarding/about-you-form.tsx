'use client'

import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Pencil } from 'lucide-react'
import { cn } from 'cn'

import { getApiErrorMessage } from '@/components/journal/api-error'
import { JadenFor } from '@/components/jaden'
import { Rise } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { chipVariants } from '@/components/ui/chip'
import {
  CURRENT_CONTEXT_MAX_LENGTH,
  FOCUS_AREAS,
  FOCUS_AREAS_MAX,
  FOCUS_AREA_OTHER_MAX_LENGTH,
  GOAL_MAX_LENGTH,
  type FocusAreaId,
  type ProfileAnswers,
  type ProfileResponse,
} from '@/src/server/api/routers/v1/profile/schema'
import { useTRPC } from '@/src/server/trpc/client'
import {
  CONTEXT_QUESTION,
  DEFAULT_TONE,
  FOCUS_QUESTION,
  GOAL_QUESTION,
  TONE_OPTIONS,
  TONE_QUESTION,
  WELCOME_INTRO,
} from './welcome-questions'

const QUESTION_COUNT = 4
const SUMMARY_STEP = QUESTION_COUNT

type Draft = {
  focusAreas: FocusAreaId[]
  focusAreaOther: string
  goal: string
  currentContext: string
  preferredTone: ProfileAnswers['preferredTone']
}

function toDraft(answers: ProfileAnswers): Draft {
  return {
    focusAreas: answers.focusAreas,
    focusAreaOther: answers.focusAreaOther ?? '',
    goal: answers.goal ?? '',
    currentContext: answers.currentContext ?? '',
    // Shown as the default choice, so save it unless the question is skipped.
    preferredTone: answers.preferredTone ?? DEFAULT_TONE,
  }
}

/** Adds a suggestion to free text, keeping within the limit. */
function appendSuggestion(current: string, suggestion: string, max: number) {
  const trimmed = current.trim()
  if (trimmed.toLowerCase().includes(suggestion.toLowerCase())) return current
  const next = trimmed ? `${trimmed.replace(/[.!]?$/, '.')} ${suggestion}` : suggestion
  return next.length <= max ? next : current
}

const FOCUS_LABELS = new Map<string, string>(FOCUS_AREAS.map((area) => [area.id, area.label]))

type AboutYouFormProps = {
  initial: ProfileAnswers
  /** `welcome`: first-run dialog, with Jaden and a "Skip for now" exit. `settings`: edit later. */
  mode: 'welcome' | 'settings'
  onSaved?: (response: ProfileResponse) => void
  onSkipAll?: () => void
  skipping?: boolean
}

/** The four guided "Tell Jaden about you" questions, then a summary to review before saving. */
export function AboutYouForm({ initial, mode, onSaved, onSkipAll, skipping }: AboutYouFormProps) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const update = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }))

  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const save = useMutation(
    trpc.v1.profile.saveAbout.mutationOptions({
      onSuccess: (response) => {
        queryClient.setQueryData(trpc.v1.profile.get.queryKey(), response)
        onSaved?.(response)
      },
    }),
  )

  const isWelcome = mode === 'welcome'
  const next = () => setStep((s) => Math.min(s + 1, SUMMARY_STEP))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  function skipQuestion() {
    if (step === 0) update({ focusAreas: [], focusAreaOther: '' })
    if (step === 1) update({ goal: '' })
    if (step === 2) update({ currentContext: '' })
    if (step === 3) update({ preferredTone: null })
    next()
  }

  function submit() {
    if (save.isPending) return
    save.mutate({
      focusAreas: draft.focusAreas,
      focusAreaOther: draft.focusAreaOther,
      goal: draft.goal,
      currentContext: draft.currentContext,
      preferredTone: draft.preferredTone,
    })
  }

  function toggleFocus(id: FocusAreaId) {
    const selected = draft.focusAreas.includes(id)
    if (!selected && draft.focusAreas.length >= FOCUS_AREAS_MAX) return
    update({
      focusAreas: selected ? draft.focusAreas.filter((a) => a !== id) : [...draft.focusAreas, id],
    })
  }

  const onSummary = step === SUMMARY_STEP

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        {isWelcome && step === 0 ? (
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <JadenFor placement="onboarding" petable={false} />
            <h2 className="font-serif text-[26px] leading-tight font-semibold text-neutral-900">
              {WELCOME_INTRO.title}
            </h2>
            <p className="max-w-[420px] text-[14px] leading-snug text-neutral-600">
              {WELCOME_INTRO.body}
            </p>
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          {isWelcome && step > 0 && (
            <JadenFor
              placement="onboarding"
              size={44}
              say={undefined}
              entrance="arrive"
              petable={false}
            />
          )}
          <p className="text-[12px] font-semibold tracking-wide text-neutral-400 uppercase">
            {onSummary ? 'Review' : `Question ${step + 1} of ${QUESTION_COUNT}`}
          </p>
        </div>
        <progress
          value={Math.min(step + 1, QUESTION_COUNT)}
          max={QUESTION_COUNT}
          aria-label={
            onSummary ? 'All questions answered' : `Question ${step + 1} of ${QUESTION_COUNT}`
          }
          className="block h-1 w-full appearance-none overflow-hidden rounded-full bg-neutral-200 [&::-moz-progress-bar]:bg-sage-500 [&::-webkit-progress-bar]:bg-neutral-200 [&::-webkit-progress-value]:bg-sage-500 [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-300"
        />
      </header>

      <Rise key={step} i={0} className="flex min-h-[260px] flex-col gap-4">
        {step === 0 && (
          <Question title={FOCUS_QUESTION.title} hint={FOCUS_QUESTION.hint}>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">{FOCUS_QUESTION.title}</legend>
              {FOCUS_AREAS.map((area) => {
                const selected = draft.focusAreas.includes(area.id)
                const full = !selected && draft.focusAreas.length >= FOCUS_AREAS_MAX
                return (
                  <button
                    key={area.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={full}
                    onClick={() => toggleFocus(area.id)}
                    className={cn(
                      chipVariants({ variant: selected ? 'filter-active' : 'filter' }),
                      'disabled:opacity-40',
                    )}
                  >
                    {selected && <Check className="size-3.5" strokeWidth={2.4} />}
                    {area.label}
                  </button>
                )
              })}
            </fieldset>
            <TextField
              id="about-focus-other"
              label="Something else"
              value={draft.focusAreaOther}
              onChange={(focusAreaOther) => update({ focusAreaOther })}
              placeholder={FOCUS_QUESTION.otherPlaceholder}
              max={FOCUS_AREA_OTHER_MAX_LENGTH}
            />
          </Question>
        )}

        {step === 1 && (
          <Question title={GOAL_QUESTION.title} hint={GOAL_QUESTION.hint}>
            <Suggestions
              label="Suggestions"
              items={GOAL_QUESTION.suggestions}
              onPick={(s) => update({ goal: appendSuggestion(draft.goal, s, GOAL_MAX_LENGTH) })}
            />
            <TextArea
              id="about-goal"
              label={GOAL_QUESTION.title}
              value={draft.goal}
              onChange={(goal) => update({ goal })}
              placeholder={GOAL_QUESTION.placeholder}
              max={GOAL_MAX_LENGTH}
            />
          </Question>
        )}

        {step === 2 && (
          <Question title={CONTEXT_QUESTION.title} hint={CONTEXT_QUESTION.hint}>
            <Suggestions
              label="Ways to start"
              items={CONTEXT_QUESTION.starters}
              onPick={(starter) =>
                update({
                  currentContext: draft.currentContext.trim()
                    ? draft.currentContext
                    : starter.replace(/…$/, ' '),
                })
              }
            />
            <TextArea
              id="about-context"
              label={CONTEXT_QUESTION.title}
              value={draft.currentContext}
              onChange={(currentContext) => update({ currentContext })}
              placeholder={CONTEXT_QUESTION.placeholder}
              max={CURRENT_CONTEXT_MAX_LENGTH}
              rows={5}
            />
          </Question>
        )}

        {step === 3 && (
          <Question title={TONE_QUESTION.title} hint={TONE_QUESTION.hint}>
            <p className="rounded-[12px] bg-neutral-100 px-3.5 py-2.5 text-[13px] leading-snug text-neutral-600 italic">
              “{TONE_QUESTION.exampleEntry}”
            </p>
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">{TONE_QUESTION.title}</legend>
              {TONE_OPTIONS.map((option) => {
                const selected = draft.preferredTone === option.value
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer flex-col gap-1.5 rounded-[14px] border px-4 py-3 text-left transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                      selected
                        ? 'border-sage-500 bg-sage-100'
                        : 'border-neutral-200 bg-surface hover:border-neutral-300',
                    )}
                  >
                    <input
                      type="radio"
                      name="preferred-tone"
                      value={option.value}
                      checked={selected}
                      onChange={() => update({ preferredTone: option.value })}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold text-neutral-900">
                        {option.label}
                        <span className="ml-2 font-medium text-neutral-400">
                          {option.description}
                        </span>
                      </span>
                      {selected && <Check className="size-4 text-sage-700" strokeWidth={2.4} />}
                    </span>
                    <span className="text-[13px] leading-snug text-neutral-600">
                      Jaden: “{option.sample}”
                    </span>
                  </label>
                )
              })}
            </fieldset>
          </Question>
        )}

        {onSummary && (
          <Question
            title="Here’s what Jaden will keep in mind"
            hint="Tap Edit to change an answer."
          >
            <dl className="lv-card divide-y divide-neutral-200 rounded-[14px]">
              <SummaryRow
                label={FOCUS_QUESTION.title}
                value={[
                  ...draft.focusAreas.map((id) => FOCUS_LABELS.get(id) ?? id),
                  ...(draft.focusAreaOther.trim() ? [draft.focusAreaOther.trim()] : []),
                ].join(', ')}
                onEdit={() => setStep(0)}
              />
              <SummaryRow
                label={GOAL_QUESTION.title}
                value={draft.goal.trim()}
                onEdit={() => setStep(1)}
              />
              <SummaryRow
                label={CONTEXT_QUESTION.title}
                value={draft.currentContext.trim()}
                onEdit={() => setStep(2)}
              />
              <SummaryRow
                label={TONE_QUESTION.title}
                value={TONE_OPTIONS.find((o) => o.value === draft.preferredTone)?.label ?? ''}
                onEdit={() => setStep(3)}
              />
            </dl>
            {save.error && (
              <p role="alert" className="text-[13px] text-neutral-900">
                {save.error.data?.code === 'BAD_REQUEST'
                  ? getApiErrorMessage(save.error)
                  : 'We couldn’t save your answers. They’re still here, so try again.'}
              </p>
            )}
          </Question>
        )}
      </Rise>

      <footer className="flex items-center justify-between gap-3">
        {step === 0 ? (
          isWelcome && onSkipAll ? (
            <button
              type="button"
              onClick={onSkipAll}
              disabled={skipping}
              className="text-[14px] font-semibold text-neutral-400 hover:text-neutral-900 disabled:opacity-60"
            >
              {skipping ? 'Skipping…' : 'Skip for now'}
            </button>
          ) : (
            <span />
          )
        ) : (
          <button
            type="button"
            onClick={back}
            className="flex items-center gap-2 text-[14px] font-semibold text-neutral-400 hover:text-neutral-900"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
            Back
          </button>
        )}

        <div className="flex items-center gap-4">
          {!onSummary && (
            <button
              type="button"
              onClick={skipQuestion}
              className="text-[13px] font-semibold text-neutral-400 hover:text-neutral-900"
            >
              Skip this question
            </button>
          )}
          {onSummary ? (
            <Button
              type="button"
              variant="ink"
              size="cta"
              onClick={submit}
              disabled={save.isPending}
            >
              {save.isPending ? 'Saving…' : isWelcome ? 'Start the tour' : 'Save'}
              {!save.isPending && isWelcome && <ArrowRight strokeWidth={2} />}
            </Button>
          ) : (
            <Button type="button" variant="ink" size="cta" onClick={next}>
              Next
              <ArrowRight strokeWidth={2} />
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}

function Question({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h3 className="font-serif text-[22px] leading-tight font-semibold text-neutral-900">
          {title}
        </h3>
        <p className="text-[13px] leading-snug text-neutral-400">{hint}</p>
      </div>
      {children}
    </>
  )
}

function Suggestions({
  label,
  items,
  onPick,
}: {
  label: string
  items: readonly string[]
  onPick: (item: string) => void
}) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">{label}</legend>
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onPick(item)}
          className={cn(chipVariants({ variant: 'suggested' }), 'hover:bg-sage-100/70')}
        >
          {item}
        </button>
      ))}
    </fieldset>
  )
}

const fieldClass =
  'lv-card w-full rounded-[14px] px-4 py-3 text-[15px] leading-[1.55] text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:ring-3 focus-visible:ring-ring/50'

function Counter({ value, max }: { value: string; max: number }) {
  const left = max - value.length
  return (
    <p
      aria-live="polite"
      className={cn(
        'mt-1 text-right text-[12px]',
        left < 20 ? 'text-amber-700' : 'text-neutral-400',
      )}
    >
      {left} characters left
    </p>
  )
}

function TextField(props: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  max: number
}) {
  return (
    <div>
      <label htmlFor={props.id} className="sr-only">
        {props.label}
      </label>
      <input
        id={props.id}
        value={props.value}
        maxLength={props.max}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={fieldClass}
      />
    </div>
  )
}

function TextArea(props: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  max: number
  rows?: number
}) {
  return (
    <div>
      <label htmlFor={props.id} className="sr-only">
        {props.label}
      </label>
      <textarea
        id={props.id}
        value={props.value}
        maxLength={props.max}
        rows={props.rows ?? 4}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={cn(fieldClass, 'resize-none')}
      />
      <Counter value={props.value} max={props.max} />
    </div>
  )
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string
  value: string
  onEdit: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <dt className="text-[12px] font-semibold text-neutral-400">{label}</dt>
        <dd
          className={cn(
            'mt-0.5 text-[14px] break-words',
            value ? 'text-neutral-900' : 'text-neutral-400',
          )}
        >
          {value || 'Skipped'}
        </dd>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit: ${label}`}
        className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-cloud-700 hover:underline"
      >
        <Pencil className="size-3.5" strokeWidth={2} />
        Edit
      </button>
    </div>
  )
}
