import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default caching: no persistent ISR store. Houseruled is a live, realtime app
// (every room is dynamic), so we don't need an R2/KV incremental cache - which
// also means zero extra Cloudflare resources to provision to deploy. If we later
// add ISR-cached marketing/library pages, wire an incrementalCache override here.
export default defineCloudflareConfig({});
