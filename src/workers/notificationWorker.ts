/*
 * This file runs the durable background worker loop that polls due deliveries.
 * It is called by the npm script `npm run worker`.
 * It calls `src/services/workerService.ts` and `src/lib/env.ts`.
 * A junior engineer often relies on API request lifecycles to finish async work, but a real delivery pipeline needs a separate worker process.
 */
import "dotenv/config";

import { env } from "@/lib/env";
import { processDueDeliveries } from "@/services/workerService";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`[worker:${env.WORKER_ID}] starting notification worker`);

  // ⚠️ SENIOR NOTE: This loop is intentionally simple, but it still isolates background work from the web server so retries survive slow or failed HTTP requests.
  while (true) {
    const result = await processDueDeliveries(env.WORKER_ID, 10);

    if (result.claimed > 0) {
      console.log(
        `[worker:${env.WORKER_ID}] processed ${result.claimed} deliveries`,
        result.results
      );
    }

    await sleep(result.claimed > 0 ? 1000 : 5000);
  }
}

main().catch((error) => {
  console.error(`[worker:${env.WORKER_ID}] fatal error`, error);
  process.exit(1);
});
