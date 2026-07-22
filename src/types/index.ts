export type RiskLevel    = 'low' | 'medium' | 'high' | 'critical'
export type ToolName     = 'Bash' | 'Write' | 'Edit' | 'MultiEdit' | 'Read' | 'bash' | 'edit' | 'write' | 'patch' | 'unknown'
export type DisplayType  = 'bash' | 'write' | 'edit' | 'multi_edit' | 'read' | 'command' | 'unknown'
export type HarnessId    = 'claude-code' | 'opencode' | 'gemini-cli' | (string & {})
export type RequestStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'timeout'
  | 'cli_pending'
  | 'answered'

// ── Multiple-choice questions (Claude Code's AskUserQuestion) ───────────────────
export type RequestKind = 'approval' | 'question'

export interface QuestionOption {
  label:        string
  description?: string
  // Optional markdown/ASCII preview (mockups, code, diagrams) for side-by-side
  // comparison. Claude Code only sets this on single-select questions.
  preview?:     string
}
export interface QuestionSpec {
  header?:      string
  question:     string
  multiSelect?: boolean
  options:      QuestionOption[]
}
export interface SelectedAnswer {
  question_index: number
  selected:       { index: number; label: string }[]
  custom_text?:   string
}

export interface DiffHunk {
  type:     'add' | 'remove' | 'context'
  content:  string
  line_old?: number
  line_new?: number
}

export interface FileDiff {
  type:         string
  file_path:    string
  language:     string
  stats:        { added: number; removed: number }
  hunks:        DiffHunk[]
  is_new_file?: boolean
  word_diff?:   Array<{ value: string; added: boolean; removed: boolean }>
  // multi_edit_diff only
  files?:       FileDiff[]
  file_count?:  number
  edit_count?:  number
  grand_stats?: { added: number; removed: number }
  // edit_diff only
  edits?:       FileDiff[]
}

export interface Machine {
  id:               string
  user_id:          string
  label:            string
  is_online:        boolean
  last_seen:        string
  created_at:       string
  paired_device_id?: string | null
  paired_at?:        string | null
  connection?:       'this' | 'other' | 'none'
  paired_device?:    MobileDevice | null
}

export interface MobileDevice {
  id:             string
  device_name:    string
  platform:       string
  last_active_at: string
  created_at:     string
}

export interface Profile {
  id:           string
  email:        string
  display_name: string | null
  avatar_url:   string | null
  updated_at:   string | null
}

export interface PendingRequest {
  id:             string
  user_id:        string
  machine_id:     string
  session_id:     string | null
  harness:        HarnessId
  tool_name:      ToolName
  display_type:   DisplayType
  summary:        string
  risk_level:     RiskLevel
  risk_reason:    string
  risk_icon:      string
  files_affected: string[]
  diff:           FileDiff | null
  command:        string | null
  file_path:      string | null
  new_content:    string | null
  old_content:    string | null
  raw_input:      Record<string, unknown> | null
  status:         RequestStatus
  response_mode:  string
  decided_at:     string | null
  decided_by:     'pc' | 'mobile' | null
  created_at:     string
  // question requests (kind='question') — undefined kind ⇒ treat as 'approval'
  kind?:             RequestKind
  question?:         { questions: QuestionSpec[] } | null
  selected_options?: SelectedAnswer[] | null
  // joined
  machines?:      Pick<Machine, 'id' | 'label' | 'is_online'>
}

// QR code payload scanned from the desktop app (for pairing, not auth)
export interface QRPayload {
  machineId: string
  apiKey:    string
  // One-time pairing nonce (5-min TTL) minted by the desktop. Required — replays
  // and stale QRs are rejected server-side.
  challenge: string
}

// ── Sessions / agents ─────────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'idle' | 'finished'

export interface AgentSession {
  id:                string
  machine_id:        string
  machine_label:     string
  machine_is_online: boolean
  session_id:        string
  cwd:               string | null
  harness:           HarnessId
  cli_alive:         boolean        // false = the CLI window was closed
  harness_enabled:   boolean        // false = mobile support for this harness is OFF on the desktop
  status:            SessionStatus
  pending_count:     number
  last_activity_at:  string
  started_at:        string
  // Live token usage — durable seed for the compose-bar counter (turn resets each turn).
  turn_tokens_input?:     number
  turn_tokens_output?:    number
  session_tokens_input?:  number
  session_tokens_output?: number
}

// Live token usage pushed over the session 'usage' broadcast (TOKEN_USAGE_STREAMING_DESIGN.md).
export interface SessionUsage {
  turnInput:      number
  turnOutput:     number
  sessionInput?:  number
  sessionOutput?: number
  cost?:          number | null
}

// ── Harness state (read from /harness/:machineId) ─────────────────────────────

export interface HarnessCapabilities {
  approvals:         boolean
  narrative:         boolean
  injection:         boolean
  fileTree:          boolean
  sessionList:       boolean
  approvalMechanism: 'hook' | 'plugin' | 'mcp' | 'pty-proxy' | 'api' | 'none'
}

export interface MachineHarness {
  harness:         HarnessId
  display_name:    string
  installed:       boolean
  mobile_enabled:  boolean
  desired_enabled: boolean | null
  capabilities:    HarnessCapabilities
  version:         string | null
  updated_at:      string
}

export interface MobileCommand {
  id:           string
  session_id:   string | null
  prompt:       string
  status:       'pending' | 'delivered' | 'cancelled'
  created_at:   string
  delivered_at: string | null
}

export interface FsNode {
  name:      string
  path:      string
  type:      'file' | 'dir'
  size?:     number
  children?: FsNode[] | null
}

// ── Paginated chat feed (GET /mobile/sessions/:id/feed) ─────────────────────────
// One unified, time-ordered stream merging the three feed sources server-side.
export type FeedSource = 'terminal' | 'request' | 'prompt'

export interface FeedRow {
  source:     FeedSource
  id:         string
  created_at: string
  row:        TerminalEvent | PendingRequest | MobileCommand
}

export interface FeedPage {
  items:      FeedRow[]      // ascending by created_at within the page
  nextCursor: string | null  // pass as `before` to fetch older; null = no more
  hasMore:    boolean
}

// ── Navigation param types ─────────────────────────────────────────────────────
import type { NavigatorScreenParams } from '@react-navigation/native'
export type { NavigatorScreenParams }

export type RootStackParamList = {
  Auth:   NavigatorScreenParams<AuthStackParamList> | undefined
  App:    NavigatorScreenParams<TabParamList> | undefined
  QRScan: undefined
}

export type AuthStackParamList = {
  SignIn:  undefined
  SignUp:  undefined
}

export type TabParamList = {
  ChatsTab:    NavigatorScreenParams<SessionsStackParamList> | undefined
  MachinesTab: undefined
  ProfileTab:  NavigatorScreenParams<ProfileStackParamList> | undefined
}

export type ProfileStackParamList = {
  Settings: undefined
  Security: undefined
}

export interface TerminalEvent {
  id:         string
  session_id: string
  machine_id: string
  harness:    HarnessId
  event_type: 'tool_start' | 'tool_end' | 'notification' | 'stop' | 'output'
  tool_name:  string | null
  summary:    string | null
  detail:     string | null
  status:     'success' | 'error' | 'stopped' | null   // 'stopped' → user-interrupted turn (StopRow tag)
  created_at: string
}

export type QRScanStackParamList = {
  QRScan: undefined
}

export type SessionsStackParamList = {
  ChatsList:    undefined
  Chat:         {
    sessionId:       string
    machineLabel:    string
    cwd:             string | null
    machineIsOnline: boolean
    harness:         HarnessId
    status:          SessionStatus
    prefill?:        string
  }
  RequestDetail: { id: string }
  FileBrowser:   { sessionId: string; machineLabel: string; cwd: string | null }
}
