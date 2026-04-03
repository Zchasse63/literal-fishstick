'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Database,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────

interface SyncEntityState {
  entity_type: string;
  last_synced_at: string | null;
  last_full_sync_at: string | null;
  records_synced: number;
  status: 'idle' | 'syncing' | 'error' | 'completed';
  error_message: string | null;
  updated_at: string;
}

interface SyncStatusResponse {
  data: SyncEntityState[];
  is_syncing: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function entityLabel(type: string): string {
  const labels: Record<string, string> = {
    members: 'Members',
    events: 'Classes',
    bookings: 'Bookings',
    transactions: 'Transactions',
    programs: 'Programs',
    facilities: 'Facilities',
    appointments: 'Appointments',
    discounts: 'Discounts',
  };
  return labels[type] ?? type;
}

function statusIcon(status: string) {
  switch (status) {
    case 'syncing':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />;
    case 'completed':
      return <Check className="h-3.5 w-3.5 text-emerald-500" />;
    case 'error':
      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
    default:
      return <Database className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />;
  }
}

// ─── Component ────────────────────────────────────────────────────

export default function DataSyncButton() {
  const [status, setStatus] = useState<SyncStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/glofox/status');
      if (!res.ok) throw new Error('Failed to fetch sync status');
      const data: SyncStatusResponse = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Fetch status on mount and poll every 15s while syncing
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!status?.is_syncing) return;
    const interval = setInterval(fetchStatus, 15_000);
    return () => clearInterval(interval);
  }, [status?.is_syncing, fetchStatus]);

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/glofox/sync', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Sync request failed');
      }
      // Re-fetch status after triggering
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleBackfill = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to run a full historical backfill? This will re-import all data from Glofox and may take several minutes.'
    );
    if (!confirmed) return;

    setBackfillLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/glofox/backfill', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Backfill request failed');
      }
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBackfillLoading(false);
    }
  };

  const isSyncing = status?.is_syncing || loading || backfillLoading;
  const lastSynced = status?.data?.reduce((latest, row) => {
    if (!row.last_synced_at) return latest;
    if (!latest) return row.last_synced_at;
    return new Date(row.last_synced_at) > new Date(latest)
      ? row.last_synced_at
      : latest;
  }, null as string | null);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm dark:border-gray-800 dark:bg-[#1A1A1F]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/40">
            <Database className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Glofox Data Sync
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isSyncing
                ? 'Syncing...'
                : `Last synced: ${formatRelativeTime(lastSynced ?? null)}`}
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-[#1A1A1F]"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`}
          />
          {loading ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Expandable details */}
      <div className="border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <span>Sync Details</span>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        {expanded && (
          <div className="px-4 pb-3">
            {/* Entity rows */}
            <div className="space-y-2">
              {(status?.data ?? []).map((entity) => (
                <div
                  key={entity.entity_type}
                  className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2 dark:bg-gray-900/50"
                >
                  <div className="flex items-center gap-2">
                    {statusIcon(entity.status)}
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {entityLabel(entity.entity_type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                      {entity.records_synced.toLocaleString()} records
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatRelativeTime(entity.last_synced_at)}
                    </span>
                  </div>
                </div>
              ))}

              {(!status?.data || status.data.length === 0) && (
                <p className="py-2 text-center text-xs text-gray-400 dark:text-gray-500">
                  No sync history yet
                </p>
              )}
            </div>

            {/* Full Backfill button */}
            <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3 dark:border-gray-800">
              <button
                onClick={handleBackfill}
                disabled={isSyncing}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50 dark:focus:ring-offset-[#1A1A1F]"
              >
                <Database className="h-3.5 w-3.5" />
                {backfillLoading ? 'Starting Backfill...' : 'Full Historical Backfill'}
              </button>
              <p className="mt-1.5 text-center text-[11px] text-gray-400 dark:text-gray-500">
                Re-imports all data from Glofox. This may take several minutes.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
