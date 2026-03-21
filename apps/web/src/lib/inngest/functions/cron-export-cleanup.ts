/**
 * Inngest Cron Function: Export Cleanup
 *
 * Runs weekly on Sunday at 3 AM ET (8:00 UTC) to clean up expired
 * report exports. Removes the file from Supabase Storage and deletes
 * the database record.
 */
import { inngest } from '@/lib/inngest/client';
import { getAdminClient } from '@/lib/inngest/helpers';

// TODO: Multi-tenancy — query `studios` table and iterate all active studios
// instead of hardcoding a single studio ID. See MED-001.
const STUDIO_ID = process.env.DEFAULT_STUDIO_ID || '11111111-1111-1111-1111-111111111111';

export const cronExportCleanup = inngest.createFunction(
  {
    id: 'cron-export-cleanup',
    name: 'Report Export Cleanup',
    retries: 2,
    concurrency: [{ limit: 1 }],
    triggers: [{ cron: '0 8 * * 0' }],
  },
  async ({ step }) => {
    const db = getAdminClient();
    const now = new Date().toISOString();

    // ── Find expired exports ───────────────────────────────────
    const expiredExports = await step.run('find-expired-exports', async () => {
      const { data, error } = await db
        .from('report_exports')
        .select('id, file_url')
        .eq('studio_id', STUDIO_ID)
        .lt('expires_at', now);

      if (error) {
        console.error('[export-cleanup] Failed to query expired exports:', error);
        return [];
      }

      return data ?? [];
    });

    if (expiredExports.length === 0) {
      return { status: 'nothing_to_clean', deleted: 0 };
    }

    // ── Delete files from Storage and records from DB ──────────
    const result = await step.run('cleanup-exports', async () => {
      let filesDeleted = 0;
      let recordsDeleted = 0;
      let errors = 0;

      for (const exp of expiredExports) {
        try {
          // Remove file from Supabase Storage if it exists
          if (exp.file_url) {
            // Extract the storage path from the URL
            // Supabase Storage URLs follow: /storage/v1/object/public/bucket/path
            // or the file_url might just be the path within the bucket
            const storagePath = extractStoragePath(exp.file_url);
            if (storagePath) {
              const { error: storageError } = await db.storage
                .from('report-exports')
                .remove([storagePath]);

              if (storageError) {
                console.warn(
                  `[export-cleanup] Failed to delete storage file for export ${exp.id}:`,
                  storageError,
                );
              } else {
                filesDeleted++;
              }
            }
          }

          // Delete the database record
          const { error: deleteError } = await db
            .from('report_exports')
            .delete()
            .eq('id', exp.id);

          if (deleteError) {
            console.error(
              `[export-cleanup] Failed to delete export record ${exp.id}:`,
              deleteError,
            );
            errors++;
          } else {
            recordsDeleted++;
          }
        } catch (err) {
          console.error(`[export-cleanup] Error processing export ${exp.id}:`, err);
          errors++;
        }
      }

      return { filesDeleted, recordsDeleted, errors };
    });

    // ── Also expire old active AI insights ─────────────────────
    const insightsExpired = await step.run('expire-old-insights', async () => {
      const { data, error } = await db
        .from('ai_insights')
        .update({ status: 'expired', updated_at: now })
        .eq('studio_id', STUDIO_ID)
        .eq('status', 'active')
        .lt('expires_at', now)
        .select('id');

      if (error) {
        console.error('[export-cleanup] Failed to expire old insights:', error);
        return 0;
      }

      return data?.length ?? 0;
    });

    return {
      status: 'completed',
      expired_exports_found: expiredExports.length,
      files_deleted: result.filesDeleted,
      records_deleted: result.recordsDeleted,
      cleanup_errors: result.errors,
      insights_expired: insightsExpired,
    };
  },
);

// ---------------------------------------------------------------------------
// Helper: extract storage path from URL
// ---------------------------------------------------------------------------

function extractStoragePath(fileUrl: string): string | null {
  try {
    // Handle full URLs: https://xxx.supabase.co/storage/v1/object/public/report-exports/path/file.csv
    const bucketMarker = '/report-exports/';
    const idx = fileUrl.indexOf(bucketMarker);
    if (idx !== -1) {
      return fileUrl.substring(idx + bucketMarker.length);
    }

    // Handle relative paths: report-exports/path/file.csv or just path/file.csv
    if (fileUrl.startsWith('report-exports/')) {
      return fileUrl.substring('report-exports/'.length);
    }

    // Assume it's already a raw path
    return fileUrl;
  } catch {
    return null;
  }
}
