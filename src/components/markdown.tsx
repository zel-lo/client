import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { Bold, Code, Heading, Italic, Link, List, ListChecks, ListOrdered, Quote } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * GitHub PR 본문과 같은 방식으로 그린다: GFM(표·체크리스트·취소선·자동 링크), 줄바꿈 유지,
 * 일부 HTML 허용. rehype-sanitize 기본 규칙이 GitHub 기준이라 스크립트·이벤트 속성은 걸러진다.
 */
export function MarkdownView({ source }: { source: string }) {
  return <div className="markdown-body">
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw, rehypeSanitize]}
      components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}>{source}</ReactMarkdown>
  </div>
}

type Action = { key: string; label: string; icon: LucideIcon; shortcut?: string }
const actions: Action[] = [
  { key: 'heading', label: '제목', icon: Heading },
  { key: 'bold', label: '굵게', icon: Bold, shortcut: 'b' },
  { key: 'italic', label: '기울임', icon: Italic, shortcut: 'i' },
  { key: 'quote', label: '인용', icon: Quote },
  { key: 'code', label: '코드', icon: Code, shortcut: 'e' },
  { key: 'link', label: '링크', icon: Link, shortcut: 'k' },
  { key: 'ul', label: '목록', icon: List },
  { key: 'ol', label: '번호 목록', icon: ListOrdered },
  { key: 'task', label: '체크리스트', icon: ListChecks },
]
const wraps: Record<string, [string, string, string]> = {
  bold: ['**', '**', '굵은 글씨'], italic: ['_', '_', '기울임 글씨'], code: ['`', '`', '코드'], link: ['[', '](https://)', '링크 텍스트'],
}
const prefixes: Record<string, string> = { heading: '### ', quote: '> ', ul: '- ', task: '- [ ] ' }

/** 선택한 글자를 감싸거나, 선택한 줄마다 접두어를 붙인다. 바뀐 문자열과 새 선택 범위를 돌려준다. */
export function applyFormat(value: string, start: number, end: number, key: string): { value: string; start: number; end: number } {
  const selected = value.slice(start, end)
  if (key === 'code' && selected.includes('\n')) {
    const block = '```\n' + selected + '\n```'
    return { value: value.slice(0, start) + block + value.slice(end), start: start + 4, end: start + 4 + selected.length }
  }
  if (wraps[key]) {
    const [before, after, placeholder] = wraps[key]
    const text = selected || placeholder
    return { value: value.slice(0, start) + before + text + after + value.slice(end), start: start + before.length, end: start + before.length + text.length }
  }
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const lines = value.slice(lineStart, end).split('\n')
  const block = lines.map((line, index) => (key === 'ol' ? `${index + 1}. ` : prefixes[key]) + line).join('\n')
  return { value: value.slice(0, lineStart) + block + value.slice(end), start: lineStart + block.length, end: lineStart + block.length }
}

/** GitHub의 PR 작성 칸처럼 작성/미리보기 탭과 서식 도구를 둔 마크다운 입력. */
export function MarkdownEditor({ label, value, onChange, disabled = false, placeholder, maxLength, optional = false }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string; maxLength?: number; optional?: boolean;
}) {
  const id = useId()
  const textarea = useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = useState<'write' | 'preview'>('write')

  function format(key: string) {
    const element = textarea.current
    if (!element) return
    const next = applyFormat(value, element.selectionStart, element.selectionEnd, key)
    if (maxLength && next.value.length > maxLength) return
    onChange(next.value)
    requestAnimationFrame(() => { element.focus(); element.setSelectionRange(next.start, next.end) })
  }

  function shortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.ctrlKey || event.metaKey)) return
    const action = actions.find(item => item.shortcut === event.key.toLowerCase())
    if (action) { event.preventDefault(); format(action.key) }
  }

  return <div className="markdown-editor">
    <div className="markdown-editor-head">
      <label htmlFor={id}>{label}{optional && <span className="optional">선택</span>}</label>
      <div className="markdown-tabs" role="tablist" aria-label={`${label} 보기 방식`}>
        <button type="button" role="tab" aria-selected={tab === 'write'} onClick={() => setTab('write')}>작성</button>
        <button type="button" role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')}>미리보기</button>
      </div>
    </div>
    <div className="markdown-frame">
      {tab === 'write' && <div className="markdown-toolbar" role="toolbar" aria-label={`${label} 서식`}>{actions.map(({ key, label: name, icon: Icon, shortcut: keyName }) =>
        <button key={key} type="button" disabled={disabled} title={keyName ? `${name} (Ctrl+${keyName.toUpperCase()})` : name} aria-label={name} onClick={() => format(key)}><Icon size={14} /></button>)}</div>}
      <textarea id={id} ref={textarea} hidden={tab !== 'write'} rows={6} value={value} disabled={disabled} maxLength={maxLength} placeholder={placeholder}
        onChange={event => onChange(event.target.value)} onKeyDown={shortcut} />
      {tab === 'preview' && <div className="markdown-preview">{value.trim() ? <MarkdownView source={value} /> : <p className="muted">미리 볼 내용이 없어요.</p>}</div>}
    </div>
    <p className="help-text markdown-hint">GitHub 마크다운을 지원해요. 표, 체크리스트(- [ ]), 코드 블록(```)도 쓸 수 있어요.</p>
  </div>
}
