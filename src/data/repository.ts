export type Repo = {
  id: string; name: string; description: string; language: string; color: string;
  branch: string; updated: string; build: 'success' | 'failed' | 'unknown'; deployment: string;
}
