"use client"

import * as React from 'react'
import { getSupabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { UploadCloud, Image as ImageIcon, X } from 'lucide-react'

type Props = {
  value?: string
  onChange: (url: string | undefined) => void
  onPreviewChange?: (url: string | undefined) => void
  className?: string
}

export default function ImageUploader({ value, onChange, onPreviewChange, className }: Props) {
  const { toast } = useToast()
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const [localPreview, setLocalPreview] = React.useState<string | null>(null)
  const previewSrc = localPreview || value

  const pick = () => inputRef.current?.click()

  React.useEffect(() => {
    if (!localPreview) return
    // once parent receives final value, release local preview
    if (value && value !== localPreview) {
      URL.revokeObjectURL(localPreview)
      setLocalPreview(null)
    }
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [value, localPreview])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement> | File) {
    const file = (e instanceof File) ? e : e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Nieprawidłowy plik', description: 'Wybierz obraz.', variant: 'destructive' as any })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Zbyt duży plik', description: 'Maksymalnie 5 MB.', variant: 'destructive' as any })
      return
    }
    const localUrl = URL.createObjectURL(file)
    setLocalPreview(localUrl)
    onPreviewChange?.(localUrl)
    setBusy(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Brak sesji')
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${user.id}/${Date.now()}.${ext}`
      // Ensure bucket 'quiz-images' exists in project settings.
      const { error: upErr } = await supabase.storage.from('quiz-images').upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('quiz-images').getPublicUrl(path)
      onPreviewChange?.(data.publicUrl)
      onChange(data.publicUrl)
      toast({ title: 'Obraz przesłany' })
    } catch (e: any) {
      if (localUrl) {
        URL.revokeObjectURL(localUrl)
        setLocalPreview(null)
        onPreviewChange?.(value)
      }
      toast({ title: 'Nie udało się przesłać', description: e?.message ?? '', variant: 'destructive' as any })
    } finally { setBusy(false) }
  }

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (ev) => {
    ev.preventDefault()
    setDragOver(false)
    const file = ev.dataTransfer.files?.[0]
    if (file) await handleFile(file)
  }

  return (
    <div
      className={cn(
        'relative rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-white/5 to-transparent dark:from-white/10 border border-white/10 shadow-inner',
        dragOver && 'ring-2 ring-primary/60',
        className,
      )}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile as any} />
      <div className="flex flex-col gap-3">
        <div className="relative overflow-hidden rounded-xl bg-black/20 min-h-[160px]">
          {previewSrc ? (
            <Image src={previewSrc} alt="Podgląd" fill className="object-cover" unoptimized={Boolean(localPreview)} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <UploadCloud className="h-8 w-8 mb-2 opacity-80" />
              Przeciągnij obraz tutaj lub kliknij „Wybierz obraz”
              <div className="mt-1 text-xs opacity-80">Rekomendacja: 800×600, JPG/PNG, ≤ 5 MB</div>
            </div>
          )}
          {/* Soft vignette */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_20%_40%,rgba(0,0,0,0.15),transparent)]" />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            {previewSrc ? 'Podgląd załadowanego obrazu' : 'Brak obrazu'}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (localPreview) {
                  URL.revokeObjectURL(localPreview)
                  setLocalPreview(null)
                }
                onPreviewChange?.(undefined)
                onChange(undefined)
              }}
              disabled={busy || !previewSrc}
            >
              <X className="h-4 w-4 mr-1" /> Usuń
            </Button>
            <Button size="sm" onClick={pick} disabled={busy}>Wybierz obraz</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
