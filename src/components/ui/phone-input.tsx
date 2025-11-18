"use client"

import React from 'react'
import PhoneInput from 'react-phone-input-2'
import { cn } from '@/lib/utils'

type PhoneInputFieldProps = {
  value?: string
  onChange?: (value: string) => void
  id?: string
  label?: React.ReactNode
  error?: boolean
  className?: string
}

export function PhoneInputField({ value, onChange, id, label, error, className }: PhoneInputFieldProps) {
  // Normalize incoming value: ensure it doesn't duplicate '+'
  const normalized = React.useMemo(() => {
    if (!value) return ''
    return value.replace(/^\+?/, '') // phone-input expects raw digits without plus
  }, [value])

  return (
    <div className={cn('space-y-1', className)}>
      {label ? (
        <label htmlFor={id} className="mb-1 block text-base text-muted-foreground">
          {label}
        </label>
      ) : null}

      <div className="relative">
        <PhoneInput
          country={'pl'}
          onlyCountries={['pl']}
          disableDropdown
          countryCodeEditable={false}
          value={normalized}
          onChange={(val: string) => {
            const withPlus = val ? `+${val.replace(/^\+?/, '')}` : ''
            onChange?.(withPlus)
          }}
          inputProps={{ id, name: id, autoComplete: 'tel' }}
          specialLabel={''}
          containerClass="!w-full"
          inputClass="!w-full !h-11 !bg-background !text-base !border-0 !ring-0 !pl-14 !pr-3 !rounded-md !text-foreground"
          buttonClass="!bg-transparent !border-0 !px-3 !pl-3"
          dropdownClass="!bg-card !text-foreground !border !border-input"
          disabled={false}
          enableSearch={false}
        />

        <div
          className={cn(
            'pointer-events-none absolute inset-0 rounded-md border transition-colors',
            error ? 'border-destructive' : 'border-input',
          )}
        />
      </div>
    </div>
  )
}

export default PhoneInputField
