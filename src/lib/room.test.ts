import { describe, it, expect } from "vitest";
import { createRoom, getRoomByCode } from "./room";
import { isValidCode } from "./code";

// No NEXT_PUBLIC_SUPABASE_* env is set under test, so these exercise the offline
// "table demo" path — no network, fully deterministic.

describe("createRoom (demo mode)", () => {
  it("returns a lobby room with a valid code owned by the host", async () => {
    const room = await createRoom({ id: "host-1", name: "Dealer" });
    expect(isValidCode(room.code)).toBe(true);
    expect(room.hostId).toBe("host-1");
    expect(room.status).toBe("lobby");
    expect(room.gameType).toBeNull();
    expect(room.settings).toMatchObject({ demo: true });
    expect(typeof room.createdAt).toBe("string");
  });

  it("generates distinct codes across calls", async () => {
    const a = await createRoom({ id: "h", name: "H" });
    const b = await createRoom({ id: "h", name: "H" });
    expect(a.code).not.toBe(b.code);
  });
});

describe("getRoomByCode (demo mode)", () => {
  it("synthesizes a lobby room for any code so the felt always renders", async () => {
    const room = await getRoomByCode("ACDEFG", "viewer-9");
    expect(room).not.toBeNull();
    expect(room?.code).toBe("ACDEFG");
    expect(room?.hostId).toBe("viewer-9");
    expect(room?.status).toBe("lobby");
  });
});
