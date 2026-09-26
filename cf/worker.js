// Charles Burgers on Cloudflare Containers — a thin Worker in front of one
// always-on container running the Next standalone server (mkan/hogwarts lane).
// Requests are forwarded as-is so the app sees the real Host header, which
// src/proxy.ts's origin check and the secure session cookie depend on.
import { Container, getContainer } from "@cloudflare/containers"

export class FoodContainer extends Container {
  defaultPort = 3000
  sleepAfter = "24h"

  constructor(ctx, env) {
    super(ctx, env)
    // Every string binding (Worker secrets + vars) becomes container env.
    // Applied at container start only — rotating a secret needs a restart.
    this.envVars = Object.fromEntries(Object.entries(env).filter(([, v]) => typeof v === "string"))
  }
}

export default {
  async fetch(request, env) {
    return getContainer(env.FOOD, "main").fetch(request)
  },
}
