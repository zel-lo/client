import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Github, RefreshCw, Plus, ExternalLink } from 'lucide-react'
import {
  connectRepository, createProject, disconnectRepository, githubConfiguration, listAvailableRepositories,
  listConnectedRepositories, listInstallations, listProjects, ProjectApiError,
} from '../lib/project-api'
import type { ConnectedRepository, Installation, Page, Project, RepositoryOption } from '../lib/project-api'

const emptyPage = <T,>(): Page<T> => ({ items: [], page: 1, hasNext: false })

export function RepositoryConnections() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [connected, setConnected] = useState<ConnectedRepository[]>([])
  const [installations, setInstallations] = useState<Page<Installation>>(emptyPage)
  const [installationId, setInstallationId] = useState('')
  const [installationPage, setInstallationPage] = useState(1)
  const [options, setOptions] = useState<Page<RepositoryOption>>(emptyPage)
  const [repositoryPage, setRepositoryPage] = useState(1)
  const [repositoryId, setRepositoryId] = useState('')
  const [installUrl, setInstallUrl] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingConnected, setLoadingConnected] = useState(false)
  const [loadingInstallations, setLoadingInstallations] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reauth, setReauth] = useState(false)
  const [notice, setNotice] = useState('')
  const project = projects.find(item => item.id === projectId)

  function report(cause: unknown) {
    setError(cause instanceof Error ? cause.message : '요청을 처리하지 못했어요.')
    setReauth(cause instanceof ProjectApiError && ['AUTHENTICATION_REQUIRED', 'GITHUB_REAUTH_REQUIRED', 'ACCOUNT_INACTIVE'].includes(cause.code))
  }

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void Promise.all([listProjects(controller.signal), githubConfiguration(controller.signal)])
      .then(([items, config]) => {
        if (controller.signal.aborted) return
        setProjects(items)
        setProjectId(current => items.some(item => item.id === current) ? current : items[0]?.id ?? '')
        setInstallUrl(config.installUrl)
      }).catch(cause => { if (!controller.signal.aborted) report(cause) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh])

  useEffect(() => {
    const controller = new AbortController()
    setConnected([])
    if (!projectId) { setLoadingConnected(false); return () => controller.abort() }
    setLoadingConnected(true)
    void listConnectedRepositories(projectId, controller.signal)
      .then(items => { if (!controller.signal.aborted) setConnected(items) })
      .catch(cause => { if (!controller.signal.aborted) report(cause) })
      .finally(() => { if (!controller.signal.aborted) setLoadingConnected(false) })
    return () => controller.abort()
  }, [projectId, refresh])

  useEffect(() => {
    const controller = new AbortController()
    setInstallations(emptyPage())
    setInstallationId('')
    setLoadingInstallations(true)
    void listInstallations(installationPage, controller.signal)
      .then(items => { if (!controller.signal.aborted) { setInstallations(items); setRepositoryPage(1); setInstallationId(items.items[0]?.id ?? '') } })
      .catch(cause => { if (!controller.signal.aborted) report(cause) })
      .finally(() => { if (!controller.signal.aborted) setLoadingInstallations(false) })
    return () => controller.abort()
  }, [installationPage, refresh])

  useEffect(() => {
    const controller = new AbortController()
    setOptions(emptyPage())
    setRepositoryId('')
    if (!installationId) { setLoadingOptions(false); return () => controller.abort() }
    setLoadingOptions(true)
    void listAvailableRepositories(installationId, repositoryPage, controller.signal)
      .then(items => { if (!controller.signal.aborted) { setOptions(items); setRepositoryId(items.items[0]?.id ?? '') } })
      .catch(cause => { if (!controller.signal.aborted) report(cause) })
      .finally(() => { if (!controller.signal.aborted) setLoadingOptions(false) })
    return () => controller.abort()
  }, [installationId, repositoryPage, refresh])

  async function create(event: FormEvent) {
    event.preventDefault()
    if (busy || !projectName.trim()) return
    setBusy(true); setError(''); setNotice('')
    try {
      const item = await createProject(projectName.trim())
      setProjects(current => [...current, item]); setProjectId(item.id); setProjectName('')
      setNotice(`${item.name} 프로젝트를 만들었어요.`)
    } catch (cause) { report(cause) } finally { setBusy(false) }
  }

  async function connect(event: FormEvent) {
    event.preventDefault()
    if (busy || !projectId || !installationId || !repositoryId) return
    setBusy(true); setError(''); setNotice('')
    try {
      const item = await connectRepository(projectId, installationId, repositoryId)
      setConnected(current => [...current, item]); setNotice(`${item.owner}/${item.name} 저장소를 연결했어요.`)
    } catch (cause) { report(cause) } finally { setBusy(false) }
  }

  async function disconnect(item: ConnectedRepository) {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await disconnectRepository(projectId, item.id)
      setConnected(current => current.filter(repo => repo.id !== item.id)); setNotice('저장소 연결을 해제했어요. GitHub 저장소는 유지됩니다.')
    } catch (cause) { report(cause) } finally { setBusy(false) }
  }

  return <section className="repository-connections" aria-label="GitHub 저장소 연결">
    <div className="section-heading"><h2>프로젝트와 GitHub 저장소</h2><button className="button" disabled={busy || loading || loadingInstallations || loadingOptions || loadingConnected} onClick={() => { setError(''); setReauth(false); setRefresh(value => value + 1) }}><RefreshCw size={14} />연결 목록 새로고침</button></div>
    <p className="section-subheading">개인 계정과 Organization의 승인된 저장소를 프로젝트에 연결하세요. 이 화면의 연결 정보는 서버에 저장됩니다.</p>
    {error && <div className="connection-error" role="alert">{error}{reauth && <Link to="/login?reauth=github">GitHub 다시 로그인</Link>}</div>}
    {notice && <p className="connection-notice" role="status">{notice}</p>}
    {loading && <p role="status">프로젝트를 불러오는 중…</p>}
    <form className="connection-project-form" onSubmit={event => void create(event)}>
      <label>새 프로젝트 이름<input required maxLength={100} value={projectName} onChange={event => setProjectName(event.target.value)} placeholder="함께 작업할 프로젝트 이름" disabled={busy || loading} /></label>
      <button className="button" disabled={busy || loading || !projectName.trim()}><Plus size={14} />프로젝트 만들기</button>
    </form>
    {!!projects.length && <label className="connection-select">연결할 프로젝트<select value={projectId} disabled={busy || loading} onChange={event => { setProjectId(event.target.value); setNotice(''); setError('') }}>{projects.map(item => <option key={item.id} value={item.id}>{item.name} · {item.role === 'OWNER' ? '소유자' : item.role}</option>)}</select></label>}
    {!loading && !projects.length && <p className="help-text">먼저 프로젝트를 만들면 저장소를 연결할 수 있어요.</p>}
    {project && <>
      <div className="section-heading"><h3>{project.name}에 연결된 저장소</h3><span className="muted small">{connected.length}개</span></div>
      {loadingConnected ? <p role="status">저장소 접근 권한을 확인하는 중…</p> : <div className="repo-grid repo-grid-page">{connected.map(item => <article className="repo-card connected-repo-card" key={item.id}>
        <div className="repo-card-head"><Github size={20} /><span className="badge">{item.privateRepository ? '비공개' : '공개'}</span></div>
        <h3><a href={item.htmlUrl} target="_blank" rel="noopener noreferrer">{item.owner}/{item.name}<ExternalLink size={13} /></a></h3>
        <p>{item.description || '설명 없음'}</p><div className="repo-card-foot"><span>{item.language || '언어 미지정'}</span><span>{item.defaultBranch}</span></div>
        <p className="help-text">{item.initialSyncCompleted ? '초기 수집 완료' : '접근 확인 완료 · 작업 데이터 수집 전'}</p>
        {project.canManageRepositories && <button className="button" disabled={busy || loading} onClick={() => void disconnect(item)}>연결 해제</button>}
      </article>)}</div>}
      {!loadingConnected && !connected.length && <p className="help-text">현재 GitHub 계정으로 볼 수 있는 연결된 저장소가 없어요.</p>}
      {project.canManageRepositories ? <div className="connection-picker">
        <div className="section-heading"><h3>저장소 연결</h3>{installUrl && <a className="button" href={installUrl} target="_blank" rel="noopener noreferrer"><Github size={14} />GitHub App 설치·저장소 선택<ExternalLink size={13} /></a>}</div>
        <p className="help-text">GitHub에서 사용할 계정과 저장소를 승인한 뒤 이 화면의 ‘연결 목록 새로고침’을 눌러주세요. Organization은 관리자 승인이 필요할 수 있어요.</p>
        {!installUrl && <p className="help-text">서버의 GitHub App 설치 주소 설정이 필요해요.</p>}
        {loadingInstallations ? <p role="status">GitHub 설치 목록을 불러오는 중…</p> : !installations.items.length && <p className="help-text">접근 가능한 GitHub App 설치가 없어요. 위 버튼으로 사용할 계정에 App을 설치해 주세요.</p>}
        <form onSubmit={event => void connect(event)}>
          <label>GitHub 계정 또는 Organization<select value={installationId} disabled={busy || loadingInstallations || !installations.items.length} onChange={event => { setInstallationId(event.target.value); setRepositoryPage(1) }}><option value="">계정 선택</option>{installations.items.map(item => <option key={item.id} value={item.id}>{item.owner} · {item.ownerType === 'Organization' ? 'Organization' : '개인 계정'}</option>)}</select></label>
          <Pagination page={installationPage} hasNext={installations.hasNext} disabled={busy || loadingInstallations} onChange={page => { setRepositoryPage(1); setInstallationPage(page) }} label="계정" />
          <label>연결할 GitHub 저장소<select value={repositoryId} disabled={busy || loadingOptions || !options.items.length} onChange={event => setRepositoryId(event.target.value)}><option value="">저장소 선택</option>{options.items.map(item => <option key={item.id} value={item.id}>{item.fullName}{item.privateRepository ? ' · 비공개' : ''}{item.archived ? ' · 보관됨' : ''}</option>)}</select></label>
          {loadingOptions && <p role="status">연결 가능한 저장소를 불러오는 중…</p>}
          {!loadingOptions && installationId && !options.items.length && <p className="help-text">이 설치에서 접근할 수 있는 저장소가 없어요. GitHub App의 저장소 선택 범위를 확인해 주세요.</p>}
          <Pagination page={repositoryPage} hasNext={options.hasNext} disabled={busy || loadingOptions} onChange={setRepositoryPage} label="저장소" />
          <button className="button button-dark" disabled={busy || loading || loadingConnected || loadingOptions || loadingInstallations || !repositoryId || !installationId}><Plus size={14} />{busy ? '처리 중…' : '선택한 저장소 연결'}</button>
        </form>
      </div> : <p className="help-text">프로젝트 소유자와 관리자만 저장소 연결을 변경할 수 있어요.</p>}
    </>}
  </section>
}

function Pagination({ page, hasNext, disabled, onChange, label }: { page: number; hasNext: boolean; disabled: boolean; onChange: (page: number) => void; label: string }) {
  if (page === 1 && !hasNext) return null
  return <div className="connection-pagination" aria-label={`${label} 페이지`}><button type="button" className="button" disabled={disabled || page === 1} onClick={() => onChange(page - 1)}>이전 {label}</button><span>{page} 페이지</span><button type="button" className="button" disabled={disabled || !hasNext} onClick={() => onChange(page + 1)}>다음 {label}</button></div>
}
