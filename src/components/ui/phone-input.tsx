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
    <div className={cn('relative', className)}>
      {/* react-phone-input-2 renders its own flag + input */}
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
        specialLabel={label ? String(label) : ''}
        containerClass="!w-full"
        // Keep sizes compact on mobile
        inputClass="!w-full !h-10 sm:!h-11 !bg-background !text-sm sm:!text-base !border-0 !ring-0 !pl-12 !pr-3 !rounded-md"
        buttonClass="!bg-transparent !border-0 !px-3"
        dropdownClass="!bg-card !text-foreground !border !border-input"
        disabled={false}
        // No country search/dropdown as it's locked to PL
        enableSearch={false}
      />

      {/* Custom border similar to NotchedInput */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-md border transition-colors',
          error ? 'border-destructive' : 'border-input',
        )}
      />
    </div>
  )
}

export default PhoneInputField
