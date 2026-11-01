import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { applyFormat, MarkdownEditor, MarkdownView } from '../src/components/markdown'

describe('마크다운 뷰어', () => {
  it('GitHub 마크다운(제목, 표, 체크리스트, 코드, 줄바꿈)을 그린다', () => {
    const { container } = render(<MarkdownView source={'## 변경 내용\n첫 줄\n둘째 줄\n\n| 항목 | 값 |\n|---|---|\n| A | 1 |\n\n- [x] 완료\n- [ ] 남음\n\n```\nconst a = 1\n```\n\n~~취소~~ https://github.com'} />)
    expect(screen.getByRole('heading', { level: 2, name: '변경 내용' })).toBeInTheDocument()
    expect(container.querySelector('br')).not.toBeNull()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked()
    expect(container.querySelector('pre code')?.textContent).toContain('const a = 1')
    expect(container.querySelector('del')?.textContent).toBe('취소')
    expect(screen.getByRole('link', { name: 'https://github.com' })).toHaveAttribute('target', '_blank')
  })

  it('허용된 HTML만 남기고 스크립트와 이벤트 속성은 지운다', () => {
    const { container } = render(<MarkdownView source={'<details><summary>더 보기</summary>숨긴 내용</details>\n\n<img src="x" onerror="alert(1)">\n\n<script>alert(1)</script>'} />)
    expect(screen.getByText('더 보기')).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull()
  })
})

describe('마크다운 에디터', () => {
  it('선택한 글자를 감싸고, 선택한 줄마다 목록 기호를 붙인다', () => {
    expect(applyFormat('안녕 세상', 3, 5, 'bold')).toEqual({ value: '안녕 **세상**', start: 5, end: 7 })
    expect(applyFormat('', 0, 0, 'link').value).toBe('[링크 텍스트](https://)')
    expect(applyFormat('a\nb', 0, 3, 'ol').value).toBe('1. a\n2. b')
    expect(applyFormat('a\nb', 2, 3, 'task').value).toBe('a\n- [ ] b')
    expect(applyFormat('x\ny', 0, 3, 'code').value).toBe('```\nx\ny\n```')
  })

  it('도구 버튼으로 서식을 넣고 미리보기 탭에서 결과를 본다', async () => {
    function Harness() {
      const [value, setValue] = useState('')
      return <MarkdownEditor label="본문" value={value} onChange={setValue} />
    }
    render(<Harness />)
    const control = userEvent.setup()
    const textbox = screen.getByRole('textbox', { name: '본문' })
    await control.type(textbox, '중요')
    textbox.setSelectionRange(0, 2)
    await control.click(screen.getByRole('button', { name: '굵게' }))
    expect(textbox).toHaveValue('**중요**')
    await control.click(screen.getByRole('tab', { name: '미리보기' }))
    const preview = screen.getByText('중요')
    expect(preview.tagName).toBe('STRONG')
    expect(within(screen.getByRole('tablist')).getByRole('tab', { name: '미리보기' })).toHaveAttribute('aria-selected', 'true')
  })
})
