import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// The adapter's bare default incremental cache is "dummy", which cannot
// serve prerendered routes at all (they 500 in the Worker). VeilLink has no
// ISR routes — every page is either fully dynamic (force-dynamic /
// revalidate = 0) or fully static — so the documented static-assets
// incremental cache is the behavior-exact choice: prerendered pages are
// served from the ASSETS binding with no extra infrastructure (no R2/KV).
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
