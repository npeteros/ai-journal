'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Reorder, useDragControls } from 'motion/react'
import { GripVertical, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SectionLabel } from '@/components/ui/card'
import {
  FRAMEWORK_ICONS,
  FrameworkCreateSchema,
} from '@/src/server/api/routers/v1/framework/schema'
import { useTRPC } from '@/src/server/trpc/client'
import {
  FRAMEWORK_FIELD_MESSAGES,
  frameworkIssueField,
  getFrameworkErrorMessage,
} from './framework-error'
import { FrameworkIcon, type FrameworkIconName } from './framework-icon'

/** `sample` is the template's placeholder hint; it is dropped once the prompt text is edited. */
type Prompt = { id: string; text: string; sample?: string }

type Initial = {
  title: string
  description: string
  icon: FrameworkIconName
  prompts: { prompt: string; sample?: string }[]
}

const ErrorText = ({ text }: { text?: string }) =>
  text ? <p className="text-[12px] font-medium text-rose-500">{text}</p> : null

function PromptRow({
  prompt,
  error,
  onChange,
  onRemove,
}: {
  prompt: Prompt
  error?: string
  onChange: (text: string) => void
  onRemove: () => void
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={prompt}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.02, boxShadow: 'var(--shadow-md)' }}
      className="flex flex-col gap-1"
    >
      <div className="lv-card flex items-center gap-2.5 rounded-xl py-3 pr-3 pl-2.5">
        <button
          type="button"
          aria-label="Drag to reorder"
          onPointerDown={(e) => controls.start(e)}
          className="cursor-grab touch-none text-neutral-400 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <input
          aria-label="Prompt"
          aria-invalid={!!error}
          value={prompt.text}
          maxLength={200}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-[14px] text-neutral-900 outline-none"
        />
        <button
          type="button"
          aria-label={`Remove "${prompt.text}"`}
          onClick={onRemove}
          className="text-neutral-400 hover:text-neutral-900"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>
      <ErrorText text={error} />
    </Reorder.Item>
  )
}

export function FrameworkBuilder({
  initial,
  frameworkId,
}: {
  initial: Initial
  frameworkId?: string
}) {
  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [icon, setIcon] = useState(initial.icon)
  const [prompts, setPrompts] = useState<Prompt[]>(() =>
    initial.prompts.map(({ prompt, sample }, i) => ({ id: `p${i}`, text: prompt, sample })),
  )
  const [draft, setDraft] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const done = async (href: string) => {
    await queryClient.invalidateQueries(trpc.v1.framework.pathFilter())
    router.push(href)
    router.refresh()
  }
  const create = useMutation(
    trpc.v1.framework.create.mutationOptions({
      onSuccess: ({ slug }) => done(`/frameworks/${slug}`),
    }),
  )
  const update = useMutation(
    trpc.v1.framework.update.mutationOptions({ onSuccess: () => done('/frameworks') }),
  )
  const saving = create.isPending || update.isPending
  const saveError = create.error ?? update.error
  const full = prompts.length >= 10

  function add() {
    const text = draft.trim()
    if (!text || full) return
    setPrompts((prev) => [...prev, { id: `p${Date.now()}`, text }])
    setDraft('')
  }

  function save() {
    const parsed = FrameworkCreateSchema.safeParse({
      title,
      description,
      icon,
      prompts: prompts.map((p) => ({ prompt: p.text, sample: p.sample })),
    })
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const { path } of parsed.error.issues) {
        const field = frameworkIssueField(path)
        // Prompt errors are keyed by the prompt's id, so they follow it when rows are reordered.
        const key = field === 'prompt' ? `prompt.${prompts[Number(path[1])]?.id}` : field
        next[key] ??= FRAMEWORK_FIELD_MESSAGES[field]
      }
      return setErrors(next)
    }
    setErrors({})
    if (frameworkId) update.mutate({ id: frameworkId, ...parsed.data })
    else create.mutate(parsed.data)
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <div className="flex h-12 items-center justify-between">
        <Link
          href="/frameworks"
          className="text-[15px] font-medium text-neutral-400 hover:text-neutral-600"
        >
          Cancel
        </Link>
        <h1 className="font-serif text-[16px] font-semibold text-neutral-900 lg:text-[20px]">
          {frameworkId ? 'Edit framework' : 'New framework'}
        </h1>
        <Button
          variant="ink-flat"
          size="md"
          className="px-[22px] text-[14px]"
          disabled={saving}
          onClick={save}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {saveError && <ErrorText text={getFrameworkErrorMessage(saveError)} />}

      <label className="sr-only" htmlFor="framework-title">
        Framework name
      </label>
      <input
        id="framework-title"
        value={title}
        maxLength={60}
        aria-invalid={!!errors.title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Name your framework"
        className="h-12 rounded-xl border border-neutral-200 bg-surface px-4 font-serif text-[15px] font-semibold text-neutral-900 outline-none focus:border-neutral-400"
      />
      <ErrorText text={errors.title} />

      <label className="sr-only" htmlFor="framework-description">
        Description
      </label>
      <input
        id="framework-description"
        value={description}
        maxLength={140}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="A short description (optional)"
        className="h-11 rounded-xl border border-neutral-200 bg-surface px-4 text-[14px] text-neutral-900 outline-none focus:border-neutral-400"
      />
      <ErrorText text={errors.description} />

      <SectionLabel className="mt-1 font-semibold tracking-[0.05em]">Icon</SectionLabel>
      <div className="flex gap-2.5">
        {FRAMEWORK_ICONS.map((name) => (
          <button
            key={name}
            type="button"
            aria-label={name}
            aria-pressed={icon === name}
            onClick={() => setIcon(name)}
            className={
              icon === name ? 'rounded-[12px] ring-2 ring-sage-700' : 'opacity-60 hover:opacity-100'
            }
          >
            <FrameworkIcon name={name} size={40} />
          </button>
        ))}
      </div>

      <SectionLabel className="mt-1 font-semibold tracking-[0.05em]">
        Prompts · {prompts.length}/10
      </SectionLabel>

      <Reorder.Group
        axis="y"
        values={prompts}
        onReorder={setPrompts}
        className="flex flex-col gap-2.5"
      >
        {prompts.map((p) => (
          <PromptRow
            key={p.id}
            prompt={p}
            error={errors[`prompt.${p.id}`]}
            onChange={(text) =>
              setPrompts((prev) =>
                prev.map((x) => (x.id === p.id ? { ...x, text, sample: undefined } : x)),
              )
            }
            onRemove={() => setPrompts((prev) => prev.filter((x) => x.id !== p.id))}
          />
        ))}
      </Reorder.Group>
      <ErrorText text={errors.prompts} />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex flex-col gap-2.5"
      >
        <div className="lv-card flex items-center gap-2.5 rounded-xl py-3 pr-3 pl-2.5">
          <GripVertical className="size-4 text-neutral-300" aria-hidden />
          <label className="sr-only" htmlFor="new-prompt">
            New prompt
          </label>
          <input
            id="new-prompt"
            value={draft}
            maxLength={200}
            disabled={full}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={full ? 'Prompt limit reached' : 'Add a prompt…'}
            className="flex-1 bg-transparent text-[14px] text-neutral-900 outline-none placeholder:text-neutral-400"
          />
        </div>
        <Button
          type="submit"
          variant="soft"
          disabled={full}
          className="h-[46px] rounded-xl text-[14px] font-semibold text-neutral-600"
        >
          <Plus className="size-[15px]" />
          Add prompt
        </Button>
      </form>
    </div>
  )
}
