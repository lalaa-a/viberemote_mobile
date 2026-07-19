import { createMMKV } from 'react-native-mmkv'
import Config from 'react-native-config'
import { useAppStore } from '../store/useAppStore'
import { getDeviceId, saveDeviceId } from './device'
import type {
  Machine, PendingRequest, AgentSession, MobileCommand,
  FsNode, TerminalEvent, MachineHarness, FeedPage, Profile, MobileDevice,
  SelectedAnswer,
} from '../types'

// One-time wipe of the legacy machine-credentials MMKV store (fresh-start decision)
createMMKV({ id: 'machine-credentials' }).clearAll()

// ── Auth headers ───────────────────────────────────────────────────────────────
// Read the access token from the in-memory Zustand store (sync, no async stampede).
// supabase-js refreshes it in the background via onAuthStateChange.
function authHeaders(): Record<string, string> {
  const token = useAppStore.getState().session?.access_token
  if (!token) throw new Error('Not authenticated')

  const h: Record<string, string> = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
  }

  const deviceId = getDeviceId()
  if (deviceId) h['x-device-id'] = deviceId
  return h
}

function apiBase(): string {
  return Config.API_URL ?? ''
}

// ── Core request helper ────────────────────────────────────────────────────────
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${apiBase()}${path}`
  const res  = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers ?? {}) },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(
      new Error((err as any).error ?? `Request failed (${res.status})`),
      { code: (err as any).code, status: res.status }
    )
  }

  return res.json() as Promise<T>
}

// ── Device registration ────────────────────────────────────────────────────────
export async function registerDevice(deviceName: string, platform: string): Promise<string> {
  const { data: { session } } = await (await import('./supabase')).supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const res = await fetch(`${apiBase()}/machines/devices`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ deviceName, platform }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error ?? 'Device registration failed')
  }
  const { deviceId } = await res.json()
  saveDeviceId(deviceId)
  useAppStore.getState().setDeviceId(deviceId)
  return deviceId
}

// List the devices registered to the signed-in user. Used to validate that a
// locally-cached deviceId still exists server-side (it won't after a DB reset).
export function fetchDevices(): Promise<Array<{ id: string; device_name: string; platform: string }>> {
  return request<Array<{ id: string; device_name: string; platform: string }>>('/machines/devices')
}

// ── Pairing ────────────────────────────────────────────────────────────────────
export function pairMachine(
  machineId: string,
  apiKey:    string,
  deviceId:  string,
  challenge: string,
): Promise<{ ok: boolean; alreadyPaired?: boolean }> {
  const token = useAppStore.getState().session?.access_token
  if (!token) throw new Error('Not authenticated')

  return fetch(`${apiBase()}/machines/${machineId}/pair`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ apiKey, deviceId, challenge }),
  }).then(async res => {
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(new Error((body as any).error ?? 'Pair failed'), { code: (body as any).code, status: res.status })
    return body
  })
}

export function unpairMachine(machineId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/machines/${machineId}/pair`, { method: 'DELETE' })
}

// ── Requests ───────────────────────────────────────────────────────────────────
export function fetchRequestById(id: string): Promise<PendingRequest> {
  return request<PendingRequest>(`/mobile/requests/${id}`)
}

export function decideRequest(
  requestId: string,
  decision:  'approved' | 'denied'
): Promise<void> {
  return request<void>('/mobile/decide', {
    method: 'POST',
    body:   JSON.stringify({ requestId, decision }),
  })
}

// Submit the chosen option(s) for a kind='question' request (AskUserQuestion).
export function answerRequest(
  requestId: string,
  answers:   SelectedAnswer[]
): Promise<void> {
  return request<void>('/mobile/answer', {
    method: 'POST',
    body:   JSON.stringify({ requestId, answers }),
  })
}

// ── Machines ───────────────────────────────────────────────────────────────────
export function fetchMachines(): Promise<Machine[]> {
  return request<Machine[]>('/mobile/machines')
}

export function deleteMachine(machineId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/machines/${machineId}`, { method: 'DELETE' })
}

// ── Push tokens ────────────────────────────────────────────────────────────────
export function registerPushToken(token: string, platform: string): Promise<void> {
  return request<void>('/mobile/push-token', {
    method: 'POST',
    body:   JSON.stringify({ token, platform }),
  })
}

// ── Sessions ───────────────────────────────────────────────────────────────────
export function fetchSessions(): Promise<AgentSession[]> {
  return request<AgentSession[]>('/mobile/sessions')
}

export function fetchSessionRequests(sessionId: string): Promise<PendingRequest[]> {
  return request<PendingRequest[]>(`/mobile/sessions/${encodeURIComponent(sessionId)}/requests?pending=true`)
}

export function fetchSessionAllRequests(sessionId: string): Promise<PendingRequest[]> {
  return request<PendingRequest[]>(`/mobile/sessions/${encodeURIComponent(sessionId)}/requests`)
}

export function fetchSessionFeed(
  sessionId: string,
  opts: { before?: string; limit?: number } = {},
): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: String(opts.limit ?? 40) })
  if (opts.before) params.set('before', opts.before)
  return request<FeedPage>(`/mobile/sessions/${encodeURIComponent(sessionId)}/feed?${params}`)
}

// ── Prompt injection ───────────────────────────────────────────────────────────
export function sendPrompt(prompt: string, sessionId?: string): Promise<{ id: string }> {
  return request<{ id: string }>('/mobile/prompt', {
    method: 'POST',
    body:   JSON.stringify({ prompt, sessionId }),
  })
}

// ── Stop (interrupt the current turn — does not kill the CLI) ─────────────────
export function stopSession(sessionId: string): Promise<{ id: string }> {
  return request<{ id: string }>(`/mobile/sessions/${encodeURIComponent(sessionId)}/stop`, {
    method: 'POST',
  })
}

export function fetchPrompts(): Promise<MobileCommand[]> {
  return request<MobileCommand[]>('/mobile/prompts')
}

export function cancelPrompt(id: string): Promise<void> {
  return request<void>(`/mobile/prompt/${id}`, { method: 'DELETE' })
}

// ── Terminal events ────────────────────────────────────────────────────────────
export function fetchTerminalEvents(sessionId?: string, limit = 60): Promise<{ events: TerminalEvent[] }> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (sessionId) params.set('session_id', sessionId)
  return request<{ events: TerminalEvent[] }>(`/mobile/terminal?${params}`)
}

// ── File tree ──────────────────────────────────────────────────────────────────
export function requestFileTree(path: string, sessionId?: string): Promise<{ requestId: string }> {
  return request<{ requestId: string }>('/mobile/fs/request', {
    method: 'POST',
    body:   JSON.stringify({ path, sessionId }),
  })
}

export function pollFileTreeResult(requestId: string): Promise<{
  status: 'pending' | 'ready' | 'error'
  result?: FsNode[]
  error?:  string
}> {
  return request(`/mobile/fs/result/${requestId}`)
}

// ── Harness state ──────────────────────────────────────────────────────────────
export function fetchHarnessState(machineId: string): Promise<MachineHarness[]> {
  return request<MachineHarness[]>(`/harness/${machineId}`)
}

export function desireHarnessToggle(machineId: string, harness: string, enabled: boolean): Promise<void> {
  return request<void>(`/harness/${machineId}/desire`, {
    method: 'POST',
    body:   JSON.stringify({ harness, enabled }),
  })
}

// ── Profile ────────────────────────────────────────────────────────────────────
export function fetchProfile(): Promise<Profile> {
  return request<Profile>('/profile')
}

export function updateProfile(patch: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/profile', {
    method: 'PATCH',
    body:   JSON.stringify(patch),
  })
}

export function changePassword(newPassword: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/profile/password', {
    method: 'POST',
    body:   JSON.stringify({ newPassword }),
  })
}

export function deleteAccount(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/profile', { method: 'DELETE' })
}
