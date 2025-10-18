// Common types for Adversus data structures

export interface Call {
  id: string;
  agentId: string;
  campaignId: string;
  leadId?: string;
  phoneNumber: string;
  startTime: string;
  endTime?: string;
  duration: number;
  status: 'completed' | 'missed' | 'abandoned' | 'in-progress';
  outcome?: string;
  recordingUrl?: string;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'on-call' | 'available';
  extension?: string;
  department?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed';
  startDate: string;
  endDate?: string;
  totalLeads: number;
  completedCalls: number;
  successRate?: number;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  campaignId: string;
  assignedAgentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Statistics {
  totalCalls: number;
  completedCalls: number;
  missedCalls: number;
  averageDuration: number;
  totalDuration: number;
  successRate: number;
  date?: string;
  agentId?: string;
  campaignId?: string;
}

export interface ReportParams {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  campaignId?: string;
  groupBy?: 'day' | 'week' | 'month' | 'agent' | 'campaign';
}

export interface ApiResponse<T> {
  data: T;
  total?: number;
  limit?: number;
  offset?: number;
  success: boolean;
  message?: string;
}

