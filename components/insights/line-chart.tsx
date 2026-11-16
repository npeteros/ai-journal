'use client'

import { useId } from 'react'
import { useReducedMotion } from 'motion/react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cssVar, type ColorToken } from '@/src/lib/design-tokens/colors'

/** `value: null` leaves a gap (a day or month with no analyzed entries). */
type Point = { label: string; value: number | null }

type LineChartProps = {
  data: Point[]
  tone?: Extract<ColorToken, 'sage-500' | 'cloud-500'>
  /** Show point markers (mood week) or just the line (trend). */
  points?: boolean
  height?: number
  /** Accessible summary of what the chart shows. */
  label: string
  /** Series name shown in the tooltip. */
  seriesLabel?: string
}

/**
 * Line + soft gradient area (shadcn chart / Recharts). Values are 0–100 mood scores; null values leave a gap.
 * Colour follows the theme via the design tokens; animation is skipped under reduced motion.
 */
export function LineChart({
  data,
  tone = 'sage-500',
  points = false,
  height = 180,
  label,
  seriesLabel = 'Mood',
}: LineChartProps) {
  const reduceMotion = useReducedMotion()
  const gradientId = `fill-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const config = { value: { label: seriesLabel, color: cssVar(tone) } } satisfies ChartConfig

  return (
    <figure className="flex flex-col">
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }} aria-hidden>
        <AreaChart
          data={data}
          margin={{ top: 12, right: 10, bottom: 0, left: 10 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="var(--neutral-200)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            interval={0}
            tick={{ fontSize: 11, fontWeight: 600 }}
          />
          <YAxis domain={[0, 100]} hide />
          <ChartTooltip
            cursor={{ stroke: 'var(--neutral-300)', strokeDasharray: '3 3' }}
            content={
              <ChartTooltipContent
                indicator="dot"
                className="lv-card rounded-xl border-0 px-3 py-2"
                formatter={(value) => (
                  <span className="flex w-full items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-neutral-600">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: 'var(--color-value)' }}
                      />
                      {seriesLabel}
                    </span>
                    <span className="font-semibold text-neutral-900 tabular-nums">
                      {String(value)}/100
                    </span>
                  </span>
                )}
              />
            }
          />
          <Area
            dataKey="value"
            type="linear"
            connectNulls={false}
            stroke="var(--color-value)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={`url(#${gradientId})`}
            dot={
              points
                ? { r: 4.5, fill: 'var(--color-value)', stroke: 'var(--surface)', strokeWidth: 2 }
                : false
            }
            activeDot={{
              r: 6,
              fill: 'var(--color-value)',
              stroke: 'var(--surface)',
              strokeWidth: 2,
            }}
            isAnimationActive={!reduceMotion}
            animationDuration={1400}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ChartContainer>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  )
}
