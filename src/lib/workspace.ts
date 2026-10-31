const validId = (id: string | null | undefined): id is string => !!id && /^\d{1,19}$/.test(id)
export function preferredProject(userId?: string) {
  if (!userId) return null
  try { const id = sessionStorage.getItem(`zello.project.${userId}`); return validId(id) ? id : null } catch { return null }
}
export function selectProjectForUser(userId: string, id: string) {
  if (!validId(id)) return
  try { sessionStorage.setItem(`zello.project.${userId}`, id) } catch { /* The current view can still select the project. */ }
  window.dispatchEvent(new CustomEvent('zello:projects-changed', { detail: { projectId: id } }))
}
export function projectsChanged() { window.dispatchEvent(new Event('zello:projects-changed')) }
