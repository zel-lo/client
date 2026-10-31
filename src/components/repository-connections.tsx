import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Github, RefreshCw, Plus, ExternalLink, X } from 'lucide-react'
import {
  connectRepository, createProject, disconnectRepository, githubAuthorization, listAvailableRepositories,
  listConnectedRepositories, listGitHubAccounts, listProjects, ProjectApiError, syncPullRequests, syncIssues,
} from '../lib/project-api'
import { projectsChanged } from '../lib/workspace'
import type { ConnectedRepository, GitHubAccount, Page, Project, RepositoryOption } from '../lib/project-api'

const emptyPage = <T,>(): Page<T> => ({ items: [], page: 1, hasNext: false })

export function RepositoryConnections({ onboarding = false }: { onboarding?: boolean }) {
  const navigate = useNavigate()
  const [accessUrl, setAccessUrl] = useState<string | null>(null)
  const location = useLocation()
  const [requestedProject] = useState(() => new URLSearchParams(location.search).get('project'))
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [connected, setConnected] = useState<ConnectedRepository[]>([])
  const [accounts, setAccounts] = useState<Page<GitHubAccount>>(emptyPage)
  const [accountPage, setAccountPage] = useState(1)
  const [account, setAccount] = useState('all')
  const [options, setOptions] = useState<Page<RepositoryOption>>(emptyPage)
  const [repositoryPage, setRepositoryPage] = useState(1)
  const [selected, setSelected] = useState<RepositoryOption[]>([])
  const [failures, setFailures] = useState<{ id: string; name: string; message: string }[]>([])
  const [progress, setProgress] = useState('')
  const connectedRequest = useRef<AbortController | null>(null)
  const [search, setSearch] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingConnected, setLoadingConnected] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reauth, setReauth] = useState(false)
  const [notice, setNotice] = useState('')
  const [accessPending, setAccessPending] = useState(false)
  const lastFocus = useRef(0)
  const project = projects.find(item => item.id === projectId)
  const connectedIds = new Set(connected.map(item => item.githubRepositoryId))
  const selectable = (item: RepositoryOption) => !item.archived && !connectedIds.has(item.id)
  const visible = options.items.filter(item => item.fullName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))

  function report(cause: unknown) {
    setError(cause instanceof Error ? cause.message : '요청을 처리하지 못했어요.')
    setReauth(cause instanceof ProjectApiError && ['AUTHENTICATION_REQUIRED', 'GITHUB_REAUTH_REQUIRED', 'ACCOUNT_INACTIVE'].includes(cause.code))
  }

  useEffect(() => {
    const controller = new AbortController()
    void githubAuthorization(controller.signal).then(result => { if (!controller.signal.aborted) setAccessUrl(result.organizationAccessUrl) }).catch(() => {})
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const check = () => {
      if (!accessPending || busy || document.visibilityState !== 'visible' || Date.now() - lastFocus.current < 1500) return
      lastFocus.current = Date.now()
      setAccessPending(false); setError(''); setReauth(false); setRefresh(value => value + 1)
    }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => { window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check) }
  }, [busy, accessPending])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void listProjects(controller.signal).then(items => {
      if (controller.signal.aborted) return
      setProjects(items)
      setProjectId(current => items.some(item => item.id === current) ? current : items.find(item => item.id === requestedProject)?.id ?? items[0]?.id ?? '')
    }).catch(cause => { if (!controller.signal.aborted) report(cause) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh, requestedProject])

  useEffect(() => {
    const controller = new AbortController()
    connectedRequest.current = controller
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
    setLoadingAccounts(true)
    void listGitHubAccounts(accountPage, controller.signal)
      .then(items => { if (!controller.signal.aborted) setAccounts(items) })
      .catch(cause => { if (!controller.signal.aborted) report(cause) })
      .finally(() => { if (!controller.signal.aborted) setLoadingAccounts(false) })
    return () => controller.abort()
  }, [accountPage, refresh])

  useEffect(() => {
    const controller = new AbortController()
    setLoadingOptions(true)
    void listAvailableRepositories(account, repositoryPage, controller.signal)
      .then(items => { if (!controller.signal.aborted) { setOptions(items) } })
      .catch(cause => { if (!controller.signal.aborted) report(cause) })
      .finally(() => { if (!controller.signal.aborted) setLoadingOptions(false) })
    return () => controller.abort()
  }, [account, repositoryPage, refresh])

  async function create(event: FormEvent) {
    event.preventDefault()
    if (busy || !projectName.trim()) return
    setBusy(true); setError(''); setNotice('')
    try {
      const item = await createProject(projectName.trim())
      setProjects(current => [...current, item]); setProjectId(item.id); setProjectName(''); setSelected([]); setFailures([]); projectsChanged()
      setNotice(`${item.name} 프로젝트를 만들었어요.`)
    } catch (cause) { report(cause) } finally { setBusy(false) }
  }

  function toggle(item: RepositoryOption) {
    setSelected(current => current.some(repo => repo.id === item.id) ? current.filter(repo => repo.id !== item.id) : current.length < 50 ? [...current, item] : current)
  }

  async function connect(event: FormEvent) {
    event.preventDefault()
    const batch = selected.filter(selectable)
    if (busy || loading || loadingConnected || (!projectId && !onboarding) || !batch.length) return
    setBusy(true); setError(''); setReauth(false); setNotice(''); setFailures([])
    let target = projectId
    const successes: ConnectedRepository[] = []
    const failed: { id: string; name: string; message: string }[] = []
    try {
      if (!target) {
        const created = await createProject(projectName.trim() || batch[0].owner)
        target = created.id
        setProjects(current => [...current, created]); setProjectId(target)
      }
      for (let index = 0; index < batch.length; index++) {
        const repo = batch[index]
        setProgress(`${index + 1}/${batch.length} · ${repo.fullName} 연결 중…`)
        try { successes.push(await connectRepository(target, repo.id)) }
        catch (cause) {
          if (cause instanceof ProjectApiError && cause.code === 'REPOSITORY_ALREADY_CONNECTED') {
            // A previous response may have been lost, or another administrator connected it.
            try {
              const actual = await listConnectedRepositories(target)
              const existing = actual.find(item => item.githubRepositoryId === repo.id)
              if (existing) { successes.push(existing); continue }
            } catch { /* Preserve a per-repository failure if access cannot be confirmed. */ }
          }
          failed.push({ id: repo.id, name: repo.fullName, message: cause instanceof Error ? cause.message : '저장소를 연결하지 못했어요.' })
          if (cause instanceof ProjectApiError && ['AUTHENTICATION_REQUIRED', 'GITHUB_REAUTH_REQUIRED', 'ACCOUNT_INACTIVE', 'PROJECT_NOT_FOUND', 'PROJECT_ADMIN_REQUIRED', 'GITHUB_ACCESS_RESTRICTED'].includes(cause.code)) {
            report(cause)
            for (const remaining of batch.slice(index + 1)) failed.push({ id: remaining.id, name: remaining.fullName, message: '연결이 중단됐어요. 권한을 확인한 뒤 다시 시도해 주세요.' })
            break
          }
        }
      }
      connectedRequest.current?.abort(); setLoadingConnected(false)
      setConnected(current => [...current.filter(repo => !successes.some(item => item.id === repo.id)), ...successes])
      const successfulIds = new Set(successes.map(item => item.githubRepositoryId))
      setSelected(current => current.filter(item => !successfulIds.has(item.id)))
      setFailures(failed)
      setNotice(`${successes.length}개 저장소 연결 완료${failed.length ? ` · ${failed.length}개 연결 실패. 실패한 저장소만 다시 시도할 수 있어요.` : '.'}`)
      if (successes.length) {
        projectsChanged()
        // Collection runs once per project after the entire batch, not once per repository.
        void syncIssues(target).then(() => window.dispatchEvent(new Event('zello:issues-updated'))).catch(cause => window.dispatchEvent(new CustomEvent('zello:issues-sync-error', { detail: { projectId: target, message: cause instanceof Error ? cause.message : '기존 이슈를 가져오지 못했어요. 다시 가져오기를 눌러주세요.' } })))
        void syncPullRequests(target).catch(() => {})
        if (onboarding && !failed.length) navigate('/issues', { replace: true })
      }
    } catch (cause) { report(cause) }
    finally { setBusy(false); setProgress('') }
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
    <div className="section-heading"><h2>프로젝트와 GitHub 저장소</h2><button className="button" disabled={busy || loading || loadingAccounts || loadingOptions || loadingConnected} onClick={() => { setError(''); setReauth(false); setRefresh(value => value + 1) }}><RefreshCw size={14} />목록 새로고침</button></div>
    <p className="section-subheading">로그인한 GitHub 계정의 개인·조직 저장소를 여기서 검색하고 프로젝트에 연결하세요.</p>
    {error && <div className="connection-error" role="alert">{error}{reauth && <Link to="/login?reauth=github">GitHub 다시 로그인</Link>}</div>}
    {notice && <p className="connection-notice" role="status">{notice}</p>}
    {loading && <p role="status">프로젝트를 불러오는 중…</p>}
    {!onboarding && <form className="connection-project-form" onSubmit={event => void create(event)}>
      <label>새 프로젝트 이름<input required maxLength={100} value={projectName} onChange={event => setProjectName(event.target.value)} placeholder="함께 작업할 프로젝트 이름" disabled={busy || loading} /></label>
      <button className="button" disabled={busy || loading || !projectName.trim()}><Plus size={14} />프로젝트 만들기</button>
    </form>}
    {!!projects.length && <label className="connection-select">연결할 프로젝트<select value={projectId} disabled={busy || loading} onChange={event => { setProjectId(event.target.value); setSelected([]); setFailures([]); setNotice(''); setError('') }}>{projects.map(item => <option key={item.id} value={item.id}>{item.name} · {item.role === 'OWNER' ? '소유자' : item.role}</option>)}</select></label>}
    {!onboarding && !loading && !projects.length && <p className="help-text">먼저 프로젝트를 만들면 저장소를 연결할 수 있어요.</p>}
    <div className="organization-access">
      <div><h3>찾는 조직이 없나요?</h3><p>GitHub에서 이 서비스의 조직 접근을 한 번 승인하면 돼요. 돌아오면 목록을 다시 확인합니다.</p></div>
      {accessUrl ? <a className="button" href={accessUrl} target="_blank" rel="noopener noreferrer" onClick={() => setAccessPending(true)}><Github size={14} />조직 접근 승인하기<ExternalLink size={13} /></a> : <Link className="button" to="/login?reauth=github">GitHub 다시 연결</Link>}
      {accessPending && <p role="status">새 탭에서 사용할 조직 옆 Grant를 눌러주세요. 승인 권한이 없으면 조직 관리자에게 요청할 수 있어요.</p>}
    </div>
    {(project || onboarding) && <>
      {project && <>
      <div className="section-heading"><h3>{project.name}에 연결된 저장소</h3><span className="muted small">{connected.length}개</span></div>
      {loadingConnected ? <p role="status">저장소 접근 권한을 확인하는 중…</p> : <div className="repo-grid repo-grid-page">{connected.map(item => <article className="repo-card connected-repo-card" key={item.id}>
        <div className="repo-card-head"><Github size={20} /><span className="badge">{item.privateRepository ? '비공개' : '공개'}</span></div>
        <h3><a href={item.htmlUrl} target="_blank" rel="noopener noreferrer">{item.owner}/{item.name}<ExternalLink size={13} /></a></h3>
        <p>{item.description || '설명 없음'}</p><div className="repo-card-foot"><span>{item.language || '언어 미지정'}</span><span>{item.defaultBranch}</span></div>
        <p className="help-text">{item.initialSyncCompleted ? '초기 수집 완료' : '연결 완료 · 작업 데이터 수집 전'}</p>
        {project.canManageRepositories && <button className="button" disabled={busy || loading} onClick={() => void disconnect(item)}>연결 해제</button>}
      </article>)}</div>}
      {!loadingConnected && !connected.length && <p className="help-text">현재 GitHub 계정으로 볼 수 있는 연결된 저장소가 없어요.</p>}
      </>}
      {(!project || project.canManageRepositories) ? <div className="connection-picker">
        <div className="section-heading"><h3>내 GitHub 저장소</h3></div>
        <form onSubmit={event => void connect(event)}>
          {onboarding && !project && <label>프로젝트 이름<input value={projectName} maxLength={100} disabled={busy} onChange={event => setProjectName(event.target.value)} placeholder={selected[0]?.owner ?? '저장소 소유자 이름으로 자동 설정'} /></label>}
          <label>GitHub 계정 또는 Organization<select value={account} disabled={busy || loadingAccounts} onChange={event => { setAccount(event.target.value); setRepositoryPage(1) }}>
            <option value="all">접근 가능한 모든 저장소</option>
            {accounts.items.map(item => <option key={item.id} value={item.type === 'USER' ? 'personal' : `organization:${item.login}`}>{item.login} · {item.type === 'USER' ? '개인 계정' : 'Organization'}</option>)}
          </select></label>
          <Pagination page={accountPage} hasNext={accounts.hasNext} disabled={busy || loadingAccounts} onChange={setAccountPage} label="조직" />
          <label>목록에서 저장소 검색<input type="search" value={search} disabled={busy} placeholder="계정/저장소 이름으로 검색" onChange={event => setSearch(event.target.value)} /></label>
          <fieldset className="repository-multiselect" aria-busy={loadingOptions}><legend>연결할 GitHub 저장소 · 여러 개 선택 가능</legend>
            <label className="repository-select-all"><input type="checkbox" checked={visible.some(selectable) && visible.filter(selectable).every(item => selected.some(repo => repo.id === item.id))} disabled={busy || loadingOptions || loadingConnected || !visible.some(selectable)} onChange={event => {
              const checked = event.target.checked
              setSelected(current => checked ? [...current, ...visible.filter(item => selectable(item) && !current.some(repo => repo.id === item.id))].slice(0, 50) : current.filter(repo => !visible.some(item => item.id === repo.id && selectable(item))))
            }} />현재 검색 결과 모두 선택</label>
            <div className="repository-options">{visible.map(item => <label className="repository-option" key={item.id}><input type="checkbox" aria-label={`${item.fullName}${item.privateRepository ? ' · 비공개' : ''}`} checked={selected.some(repo => repo.id === item.id)} disabled={busy || loadingOptions || loadingConnected || !selectable(item) || selected.length >= 50 && !selected.some(repo => repo.id === item.id)} onChange={() => toggle(item)} /><span><strong>{item.fullName}</strong><small>{connectedIds.has(item.id) ? '이미 연결됨' : item.archived ? '보관된 저장소 · 연결할 수 없음' : item.privateRepository ? '비공개' : '공개'}</small></span></label>)}</div>
          </fieldset>
          {!!selected.length && <div className="repository-selection"><p>{selected.length}개 선택 · 계정이나 페이지를 바꿔도 선택이 유지돼요.</p><div>{selected.map(item => <button className="badge" type="button" disabled={busy} key={item.id} onClick={() => toggle(item)} aria-label={`${item.fullName} 선택 해제`}>{item.fullName}<X size={12} /></button>)}</div><button className="subtle-link" type="button" disabled={busy} onClick={() => setSelected([])}>선택 모두 해제</button></div>}
          <p className="help-text">한 프로젝트에 여러 저장소를 연결할 수 있어요. 한 번에 최대 50개를 선택하세요.</p>
          {accounts.items.length === 1 && <p className="help-text">현재 개인 계정만 연결되어 있어요. 팀 저장소를 쓰려면 위에서 조직 접근을 승인하세요.</p>}
          {loadingOptions && <p role="status">GitHub 저장소를 불러오는 중…</p>}
          {!loadingOptions && !options.items.length && !error && <p className="help-text">접근 가능한 저장소가 없어요. 다른 계정을 선택하거나 GitHub 로그인 권한을 확인해 주세요.</p>}
          {search && <p className="help-text">현재 페이지에서 {visible.length}개를 찾았어요.</p>}
          <Pagination page={repositoryPage} hasNext={options.hasNext} disabled={busy || loadingOptions} onChange={setRepositoryPage} label="저장소" />
          <button className="button button-dark" disabled={busy || loading || loadingConnected || loadingOptions || !selected.some(selectable)}><Plus size={14} />{busy ? '처리 중…' : '선택한 저장소 연결'}</button>
          {progress && <p role="status">{progress}</p>}
        </form>
        {!!failures.length && <div className="connection-error" role="alert"><strong>연결하지 못한 저장소</strong><ul>{failures.map(item => <li key={item.id}>{item.name}: {item.message}</li>)}</ul></div>}
        {onboarding && !!connected.length && !!failures.length && <Link className="button" to="/issues">연결된 저장소로 시작하기</Link>}
        <p className="help-text">조직에서 OAuth 접근을 제한하는 경우 조직 관리자 승인이나 SSO 인증이 필요할 수 있어요.</p>
      </div> : <p className="help-text">프로젝트 소유자와 관리자만 저장소 연결을 변경할 수 있어요.</p>}
    </>}
  </section>
}

function Pagination({ page, hasNext, disabled, onChange, label }: { page: number; hasNext: boolean; disabled: boolean; onChange: (page: number) => void; label: string }) {
  if (page === 1 && !hasNext) return null
  return <div className="connection-pagination" aria-label={`${label} 페이지`}><button type="button" className="button" disabled={disabled || page === 1} onClick={() => onChange(page - 1)}>이전 {label}</button><span>{page} 페이지</span><button type="button" className="button" disabled={disabled || !hasNext} onClick={() => onChange(page + 1)}>다음 {label}</button></div>
}
