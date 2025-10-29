"use client";
import React from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import NotchedInput from '@/components/ui/notched-input'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [show, setShow] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast({ title: 'Hasło musi mieć min. 8 znaków', variant: 'destructive' as any })
      return
    }
    if (password !== confirm) {
      toast({ title: 'Hasła nie są takie same', variant: 'destructive' as any })
      return
    }
    try {
      setIsLoading(true)
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast({ title: 'Hasło zaktualizowane. Zaloguj się.' })
      router.push('/app')
    } catch (err: any) {
      toast({ title: 'Nie udało się zmienić hasła', description: err?.message ?? '', variant: 'destructive' as any })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container max-w-md mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Ustaw nowe hasło</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <NotchedInput
          type={show ? 'text' : 'password'}
          label="Nowe hasło"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          rightAdornment={
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShow(!show)}>
              {show ? <EyeOff /> : <Eye />}
            </Button>
          }
        />
        <NotchedInput
          type={show ? 'text' : 'password'}
          label="Powtórz hasło"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <Button type="submit" className="w-full h-11" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Zapisz nowe hasło
        </Button>
      </form>
    </div>
  )
}

