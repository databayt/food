// The deployed Worker: OpenNext's handler (the build writes ../.open-next/worker.js).
// No cron triggers — food has none.
import handler from "../.open-next/worker.js"

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache } from "../.open-next/worker.js"

export default { fetch: handler.fetch }
