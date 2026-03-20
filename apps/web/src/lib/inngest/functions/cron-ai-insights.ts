/**
 * Inngest Cron Function: AI Insights Generation
 *
 * Runs daily at 6 AM ET (11:00 UTC) to generate AI-powered business insights.
 * Gathers studio metrics from the database, calls the insight generator, and
 * persists results. Deduplicates via fingerprint — if the same insight
 * (by fingerprint) was generated within the last 7 days, it is skipped.
 */
import { inngest } from '@/lib/inngest/client';
import { getAdminClient } from '@/lib/inngest/helpers';
import { generateInsights, type StudioMetricsContext, type ClassMetrics } from '@/lib/ai/insights-generator';

const STUDIO_ID = '11111111-1111-1111-1111-111111111111';

export const cronAIInsights = inngest.createFunction(
  {
    id: 'cron-ai-insights',
    name: 'AI Insights Generation',
    retries: 2,
    concurrency: [{ limit: 10 }],
    triggers: [{ cron: '0 11 * * *' }],
  },
  async ({ step }) => {
    const db = getAdminClient();

    // ── Build the StudioMetricsContext ──────────────────────────
    const context = await step.run('gather-context', async (): Promise<StudioMetricsContext> => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const periodEnd = now.toISOString().split('T')[0];
      const periodStart = thirtyDaysAgo.toISOString().split('T')[0];
      const prevPeriodStart = sixtyDaysAgo.toISOString().split('T')[0];

      // Revenue — current 30d
      const { data: currentTx } = await db
        .from('transactions')
        .select('amount, payment_type')
        .eq('studio_id', STUDIO_ID)
        .eq('status', 'completed')
        .gte('created_at', `${periodStart}T00:00:00.000Z`)
        .lte('created_at', `${periodEnd}T23:59:59.999Z`);

      const currentTxRows = currentTx ?? [];
      const revenueCurrent = currentTxRows.reduce((s, t) => s + (t.amount ?? 0), 0);
      const merchRevenue = currentTxRows
        .filter((t) => t.payment_type === 'merch')
        .reduce((s, t) => s + (t.amount ?? 0), 0);
      const dropInRevenue = currentTxRows
        .filter((t) => t.payment_type === 'drop_in')
        .reduce((s, t) => s + (t.amount ?? 0), 0);

      // Revenue — previous 30d
      const { data: prevTx } = await db
        .from('transactions')
        .select('amount')
        .eq('studio_id', STUDIO_ID)
        .eq('status', 'completed')
        .gte('created_at', `${prevPeriodStart}T00:00:00.000Z`)
        .lt('created_at', `${periodStart}T00:00:00.000Z`);

      const revenuePrev = (prevTx ?? []).reduce((s, t) => s + (t.amount ?? 0), 0);

      // Revenue trend
      let revenueTrend: 'increasing' | 'stable' | 'declining' = 'stable';
      if (revenuePrev > 0) {
        const changePct = ((revenueCurrent - revenuePrev) / revenuePrev) * 100;
        if (changePct > 10) revenueTrend = 'increasing';
        else if (changePct < -10) revenueTrend = 'declining';
      }

      // Members
      const { count: activeMembers } = await db
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('studio_id', STUDIO_ID)
        .eq('membership_status', 'active');

      const { count: newMembers } = await db
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('studio_id', STUDIO_ID)
        .gte('created_at', `${periodStart}T00:00:00.000Z`);

      const { count: churnedMembers } = await db
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('studio_id', STUDIO_ID)
        .eq('membership_status', 'cancelled')
        .gte('updated_at', `${periodStart}T00:00:00.000Z`);

      const totalActive = activeMembers ?? 0;
      const newMem = newMembers ?? 0;
      const churned = churnedMembers ?? 0;
      const churnRate = totalActive > 0 ? (churned / (totalActive + churned)) * 100 : 0;
      const arpm = totalActive > 0 ? revenueCurrent / 100 / totalActive : 0; // convert cents to dollars

      // Classes — get per-class stats for top/bottom
      const { data: classData } = await db
        .from('classes')
        .select('id, name, capacity, booked_count, checked_in_count')
        .eq('studio_id', STUDIO_ID)
        .gte('date', periodStart)
        .lte('date', periodEnd)
        .in('status', ['completed', 'in_progress']);

      const classRows = classData ?? [];
      const classMetricsMap = new Map<string, { name: string; totalFill: number; count: number; bookings: number }>();

      for (const c of classRows) {
        const key = c.name ?? c.id;
        const existing = classMetricsMap.get(key) ?? { name: key, totalFill: 0, count: 0, bookings: 0 };
        existing.totalFill += ((c.checked_in_count ?? 0) / (c.capacity || 12)) * 100;
        existing.count += 1;
        existing.bookings += c.booked_count ?? 0;
        classMetricsMap.set(key, existing);
      }

      const classMetrics: ClassMetrics[] = [];
      for (const [, v] of classMetricsMap) {
        classMetrics.push({
          class_name: v.name,
          avg_fill_rate: Math.round((v.totalFill / v.count) * 100) / 100,
          total_bookings: v.bookings,
          trend: 'stable' as const, // simplified — full trend requires multi-period comparison
        });
      }

      classMetrics.sort((a, b) => b.avg_fill_rate - a.avg_fill_rate);
      const topClasses = classMetrics.slice(0, 5);
      const bottomClasses = classMetrics.slice(-5).reverse();

      const avgFillRate =
        classMetrics.length > 0
          ? classMetrics.reduce((s, c) => s + c.avg_fill_rate, 0) / classMetrics.length
          : 0;

      // Outstanding payments
      const { data: failedPayments } = await db
        .from('transactions')
        .select('amount')
        .eq('studio_id', STUDIO_ID)
        .eq('status', 'failed')
        .gte('created_at', `${periodStart}T00:00:00.000Z`);

      const outstandingPayments = (failedPayments ?? []).reduce((s, t) => s + (t.amount ?? 0), 0) / 100;

      return {
        studio_id: STUDIO_ID,
        period_start: periodStart,
        period_end: periodEnd,
        revenue_current_30d: revenueCurrent / 100, // cents to dollars
        revenue_previous_30d: revenuePrev / 100,
        revenue_trend: revenueTrend,
        new_members_30d: newMem,
        churned_members_30d: churned,
        total_active_members: totalActive,
        churn_rate_pct: Math.round(churnRate * 100) / 100,
        avg_class_fill_rate: Math.round(avgFillRate * 100) / 100,
        top_classes: topClasses,
        bottom_classes: bottomClasses,
        avg_revenue_per_member: Math.round(arpm * 100) / 100,
        outstanding_payments: outstandingPayments,
        merch_revenue_30d: merchRevenue / 100,
        drop_in_revenue_30d: dropInRevenue / 100,
      };
    });

    // ── Generate insights via AI ──────────────────────────────
    const insights = await step.run('generate-insights', async () => {
      return generateInsights(context);
    });

    if (!insights || insights.length === 0) {
      return { status: 'no_insights', insights_created: 0 };
    }

    // ── Deduplicate and persist ────────────────────────────────
    const persisted = await step.run('persist-insights', async () => {
      const sevenDaysAgoISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      let created = 0;
      let skipped = 0;

      for (const insight of insights) {
        // Check for existing insight with same fingerprint within 7 days
        const { data: existing } = await db
          .from('ai_insights')
          .select('id')
          .eq('studio_id', STUDIO_ID)
          .eq('fingerprint', insight.fingerprint)
          .gte('created_at', sevenDaysAgoISO)
          .limit(1);

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

        // Map urgency from existing format to the ai_insights table format
        const urgencyMap: Record<string, string> = {
          low: 'info',
          medium: 'suggestion',
          high: 'attention',
          critical: 'urgent',
        };

        // Map insight_type from existing format to the ai_insights table format
        const typeMap: Record<string, string> = {
          revenue: 'revenue',
          churn: 'retention',
          engagement: 'cross_sell',
          scheduling: 'scheduling',
          growth: 'growth',
          operational: 'anomaly',
        };

        const { error } = await db.from('ai_insights').insert({
          studio_id: STUDIO_ID,
          insight_type: typeMap[insight.insight_type] ?? insight.insight_type,
          urgency: urgencyMap[insight.urgency] ?? insight.urgency,
          status: 'active',
          title: insight.title,
          summary: insight.summary,
          detail: null,
          data_points: null,
          recommended_action: insight.recommended_action,
          action_url: insight.action_url,
          fingerprint: insight.fingerprint,
          impact_estimate: null,
          expires_at: expiresAt,
          created_at: now,
          updated_at: now,
        });

        if (error) {
          console.error('[ai-insights] Failed to insert insight:', error);
        } else {
          created++;
        }
      }

      return { created, skipped };
    });

    return {
      status: 'completed',
      insights_generated: insights.length,
      insights_created: persisted.created,
      insights_skipped_dedup: persisted.skipped,
    };
  },
);
