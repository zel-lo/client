import type { ReactNode } from 'react'
import { ArrowRight, CheckCircle2, ChevronDown, CircleDot, GitPullRequest, ListTodo } from 'lucide-react'
import './workflow-help.css'

/** Explain the result before the user takes an action. */
export function ActionContext({ title, children, destination }: { title: string; children: ReactNode; destination?: 'zello' | 'github' }) {
  return <aside className="action-context" aria-label="이 작업으로 바뀌는 내용">
    <span className="action-context-icon"><CircleDot size={18} /></span><div><strong>{title}</strong><p>{children}</p></div>
    {destination && <span className="action-destination">{destination === 'github' ? 'GitHub에 반영' : 'zello에 저장'}</span>}
  </aside>
}

/** Extra terminology help never contains form controls. */
export function InlineExplanation({ title, children }: { title: string; children: ReactNode }) {
  return <details className="inline-explanation">
    <summary><span>{title}</span><ChevronDown size={16} /></summary>
    <div className="inline-explanation-body">{children}</div>
  </details>
}

const steps = [
  { title: '할 일로 기록', body: '회의에서 정한 일이나 새 요청을 적어요. 이때는 zello에만 저장돼요.', icon: ListTodo },
  { title: '진행 시작', body: '담당자를 정하고 GitHub 이슈를 만들어요. 이슈는 개발할 내용을 기록한 작업이에요.', icon: CircleDot },
  { title: '코드 검토', body: '개발한 코드를 팀원에게 확인받아요. 이 검토 요청을 PR이라고 불러요.', icon: GitPullRequest },
  { title: '완료 소식 공유', body: '완료한 변경을 팀 업데이트로 모아요. 이렇게 정리한 글이 패치노트예요.', icon: CheckCircle2 },
]

export function WorkflowHelp({ review = false }: { review?: boolean }) {
  return <details className="workflow-help">
    <summary><span>{review ? '코드 검토(PR)가 처음인가요?' : '처음이라면, 작업 흐름을 확인해 보세요'}</span><ChevronDown size={16} /></summary>
    {review ? <div className="workflow-review-help"><p><strong>PR은 개발한 코드를 팀원에게 확인받기 위한 요청이에요.</strong> 작업 브랜치의 변경을 검토하고, 준비되면 반영할 브랜치에 합쳐요. 코드를 합치는 것을 ‘병합’이라고 해요.</p><p>검토 요청 만들기<ArrowRight size={13} />의견 확인·수정<ArrowRight size={13} />승인 후 코드 반영</p></div> : <ol>{steps.map(({ title, body, icon: Icon }, index) => <li key={title}><span className="workflow-step-number">{index + 1}</span><div><strong><Icon size={15} />{title}</strong><p>{body}</p></div></li>)}</ol>}
  </details>
}
