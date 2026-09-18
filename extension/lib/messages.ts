import type { Inventory } from './inventory';

export interface ScanRequest { type: 'SCAN'; mode: 'compact' | 'full' }
export interface GetLastScanRequest { type: 'GET_LAST_SCAN' }
export interface DownloadExportRequest { type: 'DOWNLOAD_EXPORT'; inventory: Inventory }

export type PopupRequest = ScanRequest | GetLastScanRequest | DownloadExportRequest;

export type ScanResponse =
  | { ok: true; session_id: string; count: number; folded_groups: number }
  | { ok: false; error: string };

export type GetLastScanResponse = { ok: true; inventory: Inventory | null };

export type DownloadExportResponse =
  | { ok: true; via: 'download'; path: string; absolute_path: string | null; count: number }
  | { ok: false; error: string };
