export type WorkflowStatus = 'open' | 'in_progress' | 'waiting' | 'done';

export interface FsaRecord {
  id: string; // FSA code
  loja: string;
  prioridade?: number;
  slaMin?: number;
  observacoes?: string;
  status?: WorkflowStatus;
  createdAt?: number;
  updatedAt?: number;
}

export interface AssignmentRecord {
  id: string;
  fsaId: string;
  tecnicoId: string;
  status: WorkflowStatus;
  jiraIssueKey?: string;
  currentCallId?: string;
  createdAt?: number;
}

export type ActivityType = 'checkin' | 'rat' | 'upload' | 'status_change' | 'jira_sync';

export interface ActivityRecord {
  id: string;
  fsaId: string;
  tecnicoId: string;
  tipo: ActivityType;
  payload?: Record<string, unknown>;
  ts: number;
}


