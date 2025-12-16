"use client";

import React from 'react'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

type Point = { month: string; desktop: number }

export function UsersActivityChart({ data }: { data: Point[] }) {
  const chartConfig = {
    desktop: { label: 'Podejścia', color: 'hsl(var(--primary))' },
  } as const

  const maxValue = Math.max(...data.map(d => d.desktop), 1)
  const totalValue = data.reduce((sum, d) => sum + d.desktop, 0)
  const avgValue = totalValue / data.length
  const activeMonths = data.filter(d => d.desktop > 0).length

  // Custom gradient colors based on value
  const getBarColor = (value: number) => {
    const intensity = value / maxValue
    if (intensity > 0.7) return 'url(#barGradientHigh)'
    if (intensity > 0.4) return 'url(#barGradientMid)'
    return 'url(#barGradientLow)'
  }

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-gradient-to-br from-primary to-orange-600" />
          <span className="text-white/50">Łącznie:</span>
          <span className="font-bold text-white">{totalValue}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary/40" />
          <span className="text-white/50">Średnia:</span>
          <span className="font-bold text-white">{avgValue.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-white/50">Aktywnych miesięcy:</span>
          <span className="font-bold text-emerald-400">{activeMonths}/6</span>
        </div>
      </div>
      
    <ChartContainer config={chartConfig} className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          accessibilityLayer 
          data={data}
          margin={{ top: 20, right: 20, bottom: 20, left: 0 }}
        >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="barGradientHigh" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6A27" stopOpacity={1} />
              <stop offset="50%" stopColor="#FF8A50" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#FF6A27" stopOpacity={0.7} />
            </linearGradient>
            <linearGradient id="barGradientMid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF8A50" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#FF6A27" stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id="barGradientLow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6A27" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#FF6A27" stopOpacity={0.3} />
            </linearGradient>
            {/* Glow effect */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <CartesianGrid 
            vertical={false} 
            strokeDasharray="3 3" 
            stroke="rgba(255,255,255,0.05)"
          />
          
          {/* Average line */}
          {avgValue > 0 && (
            <ReferenceLine 
              y={avgValue} 
              stroke="rgba(255,106,39,0.5)" 
              strokeDasharray="8 4"
              strokeWidth={2}
            />
          )}
          
          <XAxis
            dataKey="month"
            tickLine={false}
            tickMargin={12}
            axisLine={false}
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
            tickFormatter={(value: string) => value.slice(0, 3)}
          />
          
          <YAxis 
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
            width={35}
          />
          
          <ChartTooltip 
            cursor={{ fill: 'rgba(255,255,255,0.05)', radius: 8 }}
            content={
              <ChartTooltipContent 
                hideLabel 
                formatter={(value) => [`${value} podejść`, '']}
              />
            }
          />
          
          <Bar 
            dataKey="desktop" 
            radius={[12, 12, 4, 4]}
            maxBarSize={60}
            animationBegin={0}
            animationDuration={1500}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill={getBarColor(entry.desktop)}
                style={{
                  filter: entry.desktop === maxValue ? 'url(#glow)' : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
    </div>
  )
}

