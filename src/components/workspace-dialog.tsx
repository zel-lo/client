import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
export function Dialog({ title, heading, children, onClose, drawer = false, wide = false }: { title: string; heading?: string; children: ReactNode; onClose: () => void; drawer?: boolean; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus()
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key !== 'Tab') return
      const focusables = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled):not([hidden]), select:not(:disabled), [tabindex="0"]')
      if (!focusables?.length) return
      const first = focusables[0], last = focusables[focusables.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = old; document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [])
  return <div className={`dialog-backdrop ${drawer ? 'drawer-backdrop' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`${drawer ? 'drawer' : 'dialog dialog-scroll'} ${wide ? 'dialog-wide' : ''}`}>
      <div className="dialog-header">{heading ? <h2 className="dialog-title">{heading}</h2> : <span className="eyebrow">{title}</span>}<button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button></div>
      {drawer ? children : <div className="dialog-body">{children}</div>}
    </div>
  </div>
}
