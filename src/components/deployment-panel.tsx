import { useState } from 'react'
import type { ConnectedRepository } from '../lib/project-api'
import { useWorkspaceData } from './workspace-panels'
import { LoadingState } from './loading-state'
type Operations = { builds: { name: string; branch: string; status: string; conclusion: string | null; updatedAt: string }[]; deployments: { environment: string; sha: string; status: string; updatedAt: string | null }[]; buildError: string | null; deploymentError: string | null }
export function DeploymentPanel({ project, repositories }: { project: string; repositories: ConnectedRepository[] }) {
  const [selected, setSelected] = useState('')
  const repo = repositories.find(r => r.id === selected) ?? repositories[0]
  return <section><p>GitHub Actions와 Deployments에 기록된 최근 10개 결과를 각각 조회합니다.</p>{!repo ? <p className="empty-state">연결된 저장소가 없어요.</p> : <><label>저장소<select aria-label="빌드 저장소" value={repo.id} onChange={e => setSelected(e.target.value)}>{repositories.map(r => <option key={r.id} value={r.id}>{r.owner}/{r.name}</option>)}</select></label><Operations key={repo.id} project={project} repository={repo.id} /></>}</section>
}
function Operations({ project, repository }: { project: string; repository: string }) {
  const result = useWorkspaceData<Operations>(project, `repositories/${repository}/operations`)
  return <><button className="button" disabled={result.loading} onClick={result.refresh}>GitHub에서 새로고침</button>{result.error && <p role="alert">{result.error}</p>}{result.loading && !result.data ? <LoadingState /> : result.data && <><h2>빌드</h2>{result.data.buildError && <p role="alert">{result.data.buildError}</p>}{!result.data.buildError && !result.data.builds.length && <p>기록된 빌드가 없어요.</p>}{result.data.builds.map((b,i) => <article className="workspace-record" key={i}><strong>{b.name}</strong><p>{b.branch} · {b.conclusion ?? b.status}</p><small>{new Date(b.updatedAt).toLocaleString('ko-KR')}</small></article>)}<h2>서비스 배포</h2>{result.data.deploymentError && <p role="alert">{result.data.deploymentError}</p>}{!result.data.deploymentError && !result.data.deployments.length && <p>GitHub Deployments에 기록된 배포가 없어요.</p>}{result.data.deployments.map((d,i) => <article className="workspace-record" key={i}><strong>{d.environment}</strong><p>{d.status === 'unknown' ? '상태 확인 불가' : d.status} · {d.sha.slice(0,7)}</p>{d.updatedAt && <small>{new Date(d.updatedAt).toLocaleString('ko-KR')}</small>}</article>)}</>}</>
}
