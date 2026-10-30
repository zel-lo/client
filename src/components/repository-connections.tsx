import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Github, RefreshCw, Plus, ExternalLink } from 'lucide-react'
import {
  beginRepositoryConnection, connectRepository, createProject, disconnectRepository, getInstallation, githubConfiguration, listAvailableRepositories,
  listConnectedRepositories, listInstallations, listProjects, ProjectApiError,
} from '../lib/project-api'
import type { ConnectedRepository, Installation, Page, Project, RepositoryOption } from '../lib/project-api'

const emptyPage = <T,>(): Page<T> => ({ items: [], page: 1, hasNext: false })
const returnErrors: Record<string, string> = {
  expired: 'GitHub 연결 요청이 만료됐어요. 연결을 다시 시작해 주세요.',
  invalid: 'GitHub에서 저장소 선택을 완료하지 못했어요. 선택 내용과 팀의 승인 상태를 확인해 주세요.',
  reauth: 'GitHub 로그인이 만료됐어요. 다시 로그인한 뒤 연결해 주세요.',
  project_access: '이 프로젝트의 저장소 연결을 관리할 권한이 없어요.',
  access: '현재 계정으로 승인한 GitHub 연결을 확인하지 못했어요.',
  failed: 'GitHub 연결을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
}

export function RepositoryConnections() {
  const location = useLocation()
  const navigate = useNavigate()
  const [returned] = useState(() => {
    const params = new URLSearchParams(location.search)
    const numeric = (value: string | null) => value && /^[1-9]\d{0,18}$/.test(value) ? value : ''
    return { code: params.get('github_connection'), project: numeric(params.get('project')), installation: numeric(params.get('installation')) }
  })
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
  const [repositorySearch, setRepositorySearch] = useState('')
  const [installUrl, setInstallUrl] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingConnected, setLoadingConnected] = useState(false)
  const [loadingInstallations, setLoadingInstallations] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(returned.code && returned.code !== 'ready' ? returnErrors[returned.code] ?? returnErrors.failed : '')
  const [reauth, setReauth] = useState(returned.code === 'reauth')
  const [notice, setNotice] = useState(returned.code === 'ready' ? 'GitHub 연결을 확인했어요. 아래에서 프로젝트에 연결할 저장소를 선택하세요.' : '')
  const lastReturn = useRef(0)
  const preferredInstallation = useRef(returned.code === 'ready' ? returned.installation : '')
  const project = projects.find(item => item.id === projectId)
  const visibleOptions = options.items.filter(item => item.fullName.toLocaleLowerCase().includes(repositorySearch.trim().toLocaleLowerCase()))

  useEffect(() => {
    if (returned.code) navigate('/settings?tab=repositories', { replace: true })
  }, [navigate, returned.code])

  useEffect(() => {
    const returnedFromGithub = () => {
      if (busy || document.visibilityState !== 'visible' || Date.now() - lastReturn.current < 1500) return
      lastReturn.current = Date.now()
      setError(''); setReauth(false); setRefresh(value => value + 1)
    }
    window.addEventListener('focus', returnedFromGithub)
    document.addEventListener('visibilitychange', returnedFromGithub)
    return () => {
      window.removeEventListener('focus', returnedFromGithub)
      document.removeEventListener('visibilitychange', returnedFromGithub)
    }
  }, [busy])

  useEffect(() => {
    const reset = () => { setBusy(false); setRefresh(value => value + 1) }
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  function report(cause: unknown) {
    setError(cause instanceof Error ? cause.message : '요청을 처리하지 못했어요.')
    setReauth(cause instanceof ProjectApiError && ['AUTHENTICATION_REQUIRED', 'GITHUB_REAUTH_REQUIRED', 'ACCOUNT_INACTIVE'].includes(cause.code))
  }

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    if (refresh) setError('')
    void Promise.all([listProjects(controller.signal), githubConfiguration(controller.signal)])
      .then(([items, config]) => {
        if (controller.signal.aborted) return
        setProjects(items)
        setProjectId(current => items.some(item => item.id === current) ? current : items.find(item => item.id === returned.project)?.id ?? items[0]?.id ?? '')
        setInstallUrl(config.installUrl)
      }).catch(cause => { if (!controller.signal.aborted) report(cause) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh, returned.project])

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
    const preferred = preferredInstallation.current
    void Promise.all([listInstallations(installationPage, controller.signal),
      preferred && installationPage === 1 ? getInstallation(preferred, controller.signal) : Promise.resolve(null)])
      .then(([items, verified]) => {
        if (controller.signal.aborted) return
        const choices = verified && !items.items.some(item => item.id === verified.id) ? [verified, ...items.items] : items.items
        setInstallations({ ...items, items: choices }); setRepositoryPage(1)
        const selected = choices.find(item => item.id === preferred)?.id ?? choices[0]?.id ?? ''
        setInstallationId(selected); preferredInstallation.current = selected
      })
      .catch(cause => { if (!controller.signal.aborted) report(cause) })
      .finally(() => { if (!controller.signal.aborted) setLoadingInstallations(false) })
    return () => controller.abort()
  }, [installationPage, refresh])

  useEffect(() => {
    const controller = new AbortController()
    setOptions(emptyPage())
    setRepositoryId('')
    setRepositorySearch('')
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
    if (busy || !projectId || !installationId || !visibleOptions.some(item => item.id === repositoryId)) return
    setBusy(true); setError(''); setNotice('')
    try {
      const item = await connectRepository(projectId, installationId, repositoryId)
      setConnected(current => [...current, item]); setNotice(`${item.owner}/${item.name} 저장소를 연결했어요.`)
    } catch (cause) { report(cause) } finally { setBusy(false) }
  }

  async function authorizeGithub() {
    if (busy || !projectId) return
    setBusy(true); setError(''); setNotice('')
    try { await beginRepositoryConnection(projectId) }
    catch (cause) { report(cause); setBusy(false) }
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
        <div className="section-heading"><h3>저장소 연결</h3>{installUrl && <button className="button" disabled={busy || loading} onClick={() => void authorizeGithub()}><Github size={14} />{busy ? 'GitHub로 이동 중…' : installations.items.length ? 'GitHub 저장소 권한 변경' : 'GitHub 연결'}</button>}</div>
        <p className="help-text">이미 승인한 저장소는 아래에서 바로 선택할 수 있어요. 다른 저장소를 추가하려면 GitHub에서 접근을 승인하세요. 승인 후 이 프로젝트 화면으로 돌아옵니다.</p>
        {!installUrl && <p className="help-text">서버의 GitHub App 설치 주소 설정이 필요해요.</p>}
        {loadingInstallations ? <p role="status">GitHub 계정을 확인하는 중…</p> : !installations.items.length && <p className="help-text">아직 연결된 GitHub 계정이 없어요. ‘GitHub 연결’에서 개인 또는 팀 계정을 선택해 주세요.</p>}
        <form onSubmit={event => void connect(event)}>
          <label>GitHub 계정 또는 Organization<select value={installationId} disabled={busy || loadingInstallations || !installations.items.length} onChange={event => { setInstallationId(event.target.value); preferredInstallation.current = event.target.value; setRepositoryPage(1) }}><option value="">계정 선택</option>{installations.items.map(item => <option key={item.id} value={item.id}>{item.owner} · {item.ownerType === 'Organization' ? 'Organization' : '개인 계정'}</option>)}</select></label>
          <Pagination page={installationPage} hasNext={installations.hasNext} disabled={busy || loadingInstallations} onChange={page => { setRepositoryPage(1); setInstallationPage(page) }} label="계정" />
          <label>목록에서 저장소 검색<input type="search" value={repositorySearch} disabled={busy || loadingOptions || !options.items.length} placeholder="계정/저장소 이름으로 검색" onChange={event => { const search = event.target.value; setRepositorySearch(search); setRepositoryId(options.items.find(item => item.fullName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))?.id ?? '') }} /></label>
          <label>연결할 GitHub 저장소<select value={repositoryId} disabled={busy || loadingOptions || !visibleOptions.length} onChange={event => setRepositoryId(event.target.value)}><option value="">저장소 선택</option>{visibleOptions.map(item => <option key={item.id} value={item.id}>{item.fullName}{item.privateRepository ? ' · 비공개' : ''}{item.archived ? ' · 보관됨' : ''}</option>)}</select></label>
          {repositorySearch && <p className="help-text">현재 페이지에서 {visibleOptions.length}개를 찾았어요.</p>}
          {loadingOptions && <p role="status">연결 가능한 저장소를 불러오는 중…</p>}
          {!loadingOptions && installationId && !options.items.length && <p className="help-text">이 계정에서 연결할 수 있는 저장소가 없어요. ‘GitHub 저장소 권한 변경’에서 사용할 저장소에 접근을 허용해 주세요.</p>}
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
