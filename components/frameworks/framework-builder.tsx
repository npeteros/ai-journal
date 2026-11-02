'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Reorder, useDragControls } from 'motion/react'
import { GripVertical, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SectionLabel } from '@/components/ui/card'

type Prompt = { id: string; text: string }

function PromptRow({ prompt, onRemove }: { prompt: Prompt; onRemove: () => void }) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={prompt}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.02, boxShadow: 'var(--shadow-md)' }}
      className="lv-card flex items-center gap-2.5 rounded-xl py-3 pr-3 pl-2.5"
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab touch-none text-neutral-400 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="flex-1 text-[14px] text-neutral-900">{prompt.text}</span>
      <button
        type="button"
        aria-label={`Remove "${prompt.text}"`}
        onClick={onRemove}
        className="text-neutral-400 hover:text-neutral-900"
      >
        <X className="size-4" strokeWidth={2} />
      </button>
    </Reorder.Item>
  )
}

/** Build a custom framework: name it, add prompts, drag to reorder. */
export function FrameworkBuilder({ initial }: { initial: { title: string; prompts: string[] } }) {
  const [title, setTitle] = useState(initial.title)
  const [prompts, setPrompts] = useState<Prompt[]>(() =>
    initial.prompts.map((text, i) => ({ id: `p${i}`, text })),
  )
  const [draft, setDraft] = useState('')

  function add() {
    const text = draft.trim()
    if (!text) return
    setPrompts((prev) => [...prev, { id: `p${Date.now()}`, text }])
    setDraft('')
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
          New framework
        </h1>
        <Button asChild variant="ink-flat" size="md" className="px-[22px] text-[14px]">
          {/* Placeholder: persist the framework */}
          <Link href="/frameworks">Save</Link>
        </Button>
      </div>

      <label className="sr-only" htmlFor="framework-title">
        Framework name
      </label>
      <input
        id="framework-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Name your framework"
        className="h-12 rounded-xl border border-neutral-200 bg-surface px-4 font-serif text-[15px] font-semibold text-neutral-900 outline-none focus:border-neutral-400"
      />

      <SectionLabel className="mt-1 font-semibold tracking-[0.05em]">Prompts</SectionLabel>

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
            onRemove={() => setPrompts((prev) => prev.filter((x) => x.id !== p.id))}
          />
        ))}
      </Reorder.Group>

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
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a prompt…"
            className="flex-1 bg-transparent text-[14px] text-neutral-900 outline-none placeholder:text-neutral-400"
          />
        </div>
        <Button
          type="submit"
          variant="soft"
          className="h-[46px] rounded-xl text-[14px] font-semibold text-neutral-600"
        >
          <Plus className="size-[15px]" />
          Add prompt
        </Button>
      </form>
    </div>
  )
}
