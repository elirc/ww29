/*
 * This file gathers cross-cutting monitoring queries for the admin dashboard.
 * It is called by `src/services/monitoringService.ts`.
 * It calls other repositories and Prisma-backed query helpers.
 * A junior engineer often duplicates dashboard metrics across routes instead of creating a single reviewable read model.
 */
import {
  countBatchesByStatus,
  listRecentBatches
} from "@/repositories/notificationRepository";
import {
  countDeliveriesByStatus,
  countStaleProcessingDeliveries,
  listRecentFailedDeliveries
} from "@/repositories/deliveryRepository";

export async function getDashboardSnapshot() {
  // ⚠️ SENIOR NOTE: Dashboard reads are aggregated here so operators do not build competing ad hoc monitoring queries with different definitions.
  const [deliveryCounts, batchCounts, staleProcessingCount, recentFailures, recentBatches] =
    await Promise.all([
      countDeliveriesByStatus(),
      countBatchesByStatus(),
      countStaleProcessingDeliveries(),
      listRecentFailedDeliveries(),
      listRecentBatches()
    ]);

  return {
    deliveryCounts,
    batchCounts,
    staleProcessingCount,
    recentFailures,
    recentBatches
  };
}
