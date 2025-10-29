"use client";

import React from 'react'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

type Point = { month: string; desktop: number }

export function UsersActivityChart({ data }: { data: Point[] }) {
  const chartConfig = {
    desktop: { label: 'Desktop', color: 'hsl(var(--primary))' },
  } as const

  return (
    <ChartContainer config={chartConfig}>
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value: string) => value.slice(0, 3)}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={8} />
      </BarChart>
    </ChartContainer>
  )
}

