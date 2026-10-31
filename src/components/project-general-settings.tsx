import { useEffect, useState } from 'react'
import { projectDetail, updateProject } from '../lib/members-api'
import type { Project } from '../lib/project-api'
import { projectsChanged } from '../lib/workspace'

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
  return <section className="project-general-settings"><h2>프로젝트 기본 설정</h2>{!project && !error && <p role="status">프로젝트를 불러오고 있어요…</p>}
    {project && <form className="settings-form" onSubmit={event => { event.preventDefault(); void save() }}><label>프로젝트 이름<input required maxLength={100} value={name} disabled={busy || !canManage} onChange={event => setName(event.target.value)} /></label><label>프로젝트 설명<textarea maxLength={4000} rows={4} value={description} disabled={busy || !canManage} onChange={event => setDescription(event.target.value)} /></label>{canManage ? <button className="button button-dark" disabled={busy || !name.trim() || project.version === undefined}>{busy ? '저장 중…' : '설정 저장'}</button> : <p className="help-text">소유자와 관리자만 프로젝트 정보를 변경할 수 있어요.</p>}</form>}
    {error && <p className="connection-error" role="alert">{error}<button className="button" onClick={() => setRevision(value => value + 1)}>최신 설정 확인</button></p>}{notice && <p className="connection-notice" role="status">{notice}</p>}
  </section>
}
