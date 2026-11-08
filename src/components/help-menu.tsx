import { useEffect, useRef, useState } from 'react'
import { BookOpen, CircleHelp, Compass, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { HELP_URL, hasTour, startTour } from '../lib/tours'

export function HelpMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!anchor.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [open])
  const tour = hasTour(pathname)
  return <div className="help-anchor" ref={anchor}>
    <button className="icon-button" aria-label="도움말" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}><CircleHelp size={18} /></button>
    {open && <div className="help-menu" role="menu">
      <button role="menuitem" disabled={!tour} onClick={() => { setOpen(false); startTour(pathname) }}>
        <Compass size={15} /><span><strong>이 화면 둘러보기</strong><small>{tour ? '주요 기능을 차례로 짚어 드려요' : '이 화면은 준비 중이에요'}</small></span>
      </button>
      {HELP_URL
        ? <a role="menuitem" href={HELP_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}><BookOpen size={15} /><span><strong>도움말 보기</strong><small>새 탭에서 사용 안내를 열어요</small></span></a>
        : <button role="menuitem" disabled><BookOpen size={15} /><span><strong>도움말 보기</strong><small>준비 중이에요</small></span></button>}
      <Link role="menuitem" to="/privacy" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}><ShieldCheck size={15} /><span><strong>개인정보처리방침</strong><small>정보 처리와 보관 기준</small></span></Link>
    </div>}
  </div>
}
