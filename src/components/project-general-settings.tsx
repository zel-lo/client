import { useEffect, useState } from 'react'
import { projectDetail, updateProject } from '../lib/members-api'
import type { Project } from '../lib/project-api'
import { projectsChanged } from '../lib/workspace'
import './project-settings.css'
import { LoadingState } from './loading-state'

export function ProjectGeneralSettings({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setProject(null); setError('')
    void projectDetail(projectId, controller.signal).then(value => {
      if (!controller.signal.aborted) { setProject(value); setName(value.name); setDescription(value.description ?? '') }
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '프로젝트를 불러오지 못했어요.') })
    return () => controller.abort()
  }, [projectId, revision])
  const canManage = project?.role === 'OWNER' || project?.role === 'ADMIN'
  async function save() {
    if (!project || project.version === undefined || !canManage || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const updated = await updateProject(projectId, project.version, name.trim(), description.trim())
      setProject(updated); setName(updated.name); setDescription(updated.description ?? '')
      setNotice('프로젝트 정보를 저장했어요.'); projectsChanged()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '설정을 저장하지 못했어요.') }
    finally { setBusy(false) }
  }
  return <section className="project-general-settings">{!project && !error && <LoadingState layout="settings" label="프로젝트 설정을 불러오는 중" />}
    {project && <form className="settings-form" onSubmit={event => { event.preventDefault(); void save() }}>
      <h2>기본 정보</h2>
      <label className="project-setting-row"><span>프로젝트 이름</span><input required maxLength={100} value={name} disabled={busy || !canManage} onChange={event => setName(event.target.value)} /></label>
      <label className="project-setting-row"><span>프로젝트 설명<span className="setting-optional" aria-hidden="true">선택</span></span><textarea maxLength={4000} rows={3} value={description} placeholder="프로젝트의 목표나 함께할 일을 적어 주세요." disabled={busy || !canManage} onChange={event => setDescription(event.target.value)} /></label>
      <div className="project-settings-footer">{canManage ? <button className="button button-dark" disabled={busy || !name.trim() || project.version === undefined}>{busy ? '저장 중…' : '설정 저장'}</button> : <p className="help-text">소유자와 관리자만 프로젝트 정보를 변경할 수 있어요.</p>}</div>
    </form>}
    {project?.startDate && project.endDate && <section className="project-period-settings" aria-label="프로젝트 기간"><h2>프로젝트 기간</h2><dl><div><dt>시작일</dt><dd><time dateTime={project.startDate}>{project.startDate.replaceAll('-', '.')}</time></dd></div><div><dt>종료일</dt><dd><time dateTime={project.endDate}>{project.endDate.replaceAll('-', '.')}</time></dd></div>{project.totalWeeks != null && <div><dt>전체 주차</dt><dd>{project.totalWeeks}주</dd></div>}</dl></section>}
    {error && <p className="connection-error" role="alert">{error}<button className="button" onClick={() => setRevision(value => value + 1)}>최신 설정 확인</button></p>}{notice && <p className="connection-notice" role="status">{notice}</p>}
  </section>
}
