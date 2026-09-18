import type { AxNode } from './reducer';

export interface ResolveNodeResult {
  object?: { objectId?: string };
}

export interface CallFunctionOnResult {
  result?: { value?: Record<string, unknown> };
}

export type DebuggerSend = <T>(method: string, params?: object) => Promise<T>;

// Accessibility.getFullAXTree 响应（实际用到的最小子集）
export interface GetFullAXTreeResult {
  nodes: AxNode[];
}
