import { useEffect } from 'react'
import { useGame } from '../store/gameStore'
import { IconCheck } from './Icons'

export function Toast() {
  const toast = useGame((s) => s.toast)
  const showToast = useGame((s) => s.showToast)
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => showToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast, showToast])
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4" role="status" aria-live="polite">
      <div className="animate-fade-in flex max-w-[398px] items-center gap-2 rounded-xl bg-accent px-4 py-3 text-[14px] font-bold text-bg shadow-lg">
        <IconCheck size={18} />
        {toast}
      </div>
    </div>
  )
}
