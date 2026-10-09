import { describe, expect, it, vi } from "vitest";
// The Pages front door is plain JS (proxy/public/_worker.js); test it directly.
import proxy from "../../proxy/public/_worker.js";

describe("playhouseruled.pages.dev proxy", () => {
  it("forwards the untouched request to the houseruled Worker", async () => {
    const upstream = new Response("ok", { status: 201 });
    const APP = { fetch: vi.fn(async () => upstream) };
    const req = new Request("https://playhouseruled.pages.dev/api/room/ABCDEF", { method: "POST", body: "{}" });
    const res = await proxy.fetch(req, { APP });
    expect(APP.fetch).toHaveBeenCalledWith(req);
    expect(res).toBe(upstream);
  });

  it("503s with Retry-After if the service binding is missing", async () => {
    const res = await proxy.fetch(new Request("https://playhouseruled.pages.dev/"), {});
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("30");
  });
});
