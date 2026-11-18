'use client'

import { useReducedMotion } from 'motion/react'
import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cssVar } from '@/src/lib/design-tokens/colors'

type Row = {
  label: string
  value: number
  meta?: string
  /** One-line explanation shown under the value in the hover tooltip. */
  hint?: string
}

type BarListProps = {
  data: Row[]
  tone?: 'sage' | 'cloud' | 'amber'
  /** Series name shown in the tooltip (e.g. "Share of entries"). */
  seriesLabel: string
  /** Format the value in the tooltip. */
  unit?: string
  /** Accessible summary. */
  label: string
}

const ROW_HEIGHT = 46
const BAR = 8

type LabelProps = {
  x?: number | string
  y?: number | string
  width?: number | string
  value?: unknown
  index?: number
}

/**
 * Horizontal bars with the label above each bar and the value (or meta) on the right
 * ("Top themes", "Personality"). 0–100 scale; the track is the bar background.
 */
export function BarList({ data, tone = 'sage', seriesLabel, unit = '%', label }: BarListProps) {
  const reduceMotion = useReducedMotion()
  const config = {
    value: { label: seriesLabel, color: cssVar(`${tone}-500`) },
  } satisfies ChartConfig
  const height = data.length * ROW_HEIGHT

  const num = (v: number | string | undefined) => (typeof v === 'number' ? v : Number(v ?? 0))
  // The end label travels with its row. Looking it up by `index` mislabels rows, because Recharts
  // renumbers labels when it drops a bar.
  const rows = data.map((row) => ({ ...row, end: row.meta ?? `${row.value}${unit}` }))

  return (
    <figure>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }} aria-hidden>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 18, right: 0, bottom: 0, left: 0 }}
          barCategoryGap={ROW_HEIGHT - BAR}
          accessibilityLayer
        >
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="label" hide />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                className="lv-card rounded-xl border-0 px-3 py-2"
                formatter={(value, _name, item) => {
                  const row = item.payload as Row
                  return (
                    <span className="flex w-full flex-col gap-1">
                      <span className="flex w-full items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-neutral-600">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: 'var(--color-value)' }}
                          />
                          {row.label}
                        </span>
                        <span className="font-semibold text-neutral-900 tabular-nums">
                          {String(value)}
                          {unit}
                        </span>
                      </span>
                      {row.hint && (
                        <span className="max-w-[240px] text-[12px] leading-snug text-neutral-500">
                          {row.hint}
                        </span>
                      )}
                    </span>
                  )
                }}
              />
            }
          />
          <Bar
            dataKey="value"
            fill="var(--color-value)"
            radius={4}
            barSize={BAR}
            // Recharts drops zero-width bars along with their labels, so a 0 would lose its row.
            minPointSize={2}
            background={{ fill: 'var(--neutral-100)', radius: 4 }}
            isAnimationActive={!reduceMotion}
            animationDuration={1200}
            animationEasing="ease-out"
          >
            <LabelList
              dataKey="label"
              content={({ x, y, value }: LabelProps) => (
                <text
                  x={num(x)}
                  y={num(y) - 9}
                  className="fill-neutral-900 text-[13px] font-semibold"
                >
                  {String(value)}
                </text>
              )}
            />
            <LabelList
              dataKey="end"
              content={({ y, value }: LabelProps) => (
                <text
                  x="100%"
                  y={num(y) - 9}
                  textAnchor="end"
                  className="fill-neutral-400 text-[13px]"
                >
                  {String(value)}
                </text>
              )}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  )
}
