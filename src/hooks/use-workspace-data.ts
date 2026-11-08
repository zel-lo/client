import { useEffect, useState } from 'react'
import { workspaceGet } from '../lib/workspace-api'

export function useWorkspaceData<T>(project: string, path: string) {
  const [value, setValue] = useState<{ key: string; data: T } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, refresh] = useState(0)
  const key = `${project}/${path}`
  useEffect(() => {
    const update = () => refresh(n => n + 1)
    const events = ['zello:workspace-updated', 'zello:issues-updated', 'zello:pull-requests-updated']
    events.forEach(event => window.addEventListener(event, update))
    return () => events.forEach(event => window.removeEventListener(event, update))
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    if (!project) { setLoading(false); return () => controller.abort() }
    workspaceGet<T>(project, path, controller.signal)
      .then(data => { if (!controller.signal.aborted) setValue({ key, data }) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [key, project, path, revision])
  return { data: value?.key === key ? value.data : null, loading, error, refresh: () => refresh(n => n + 1) }
}
