import { describe, expect, test, vi } from "vitest";
import * as auth from "~encore/auth";
import { me } from "./hello";

describe("me", () => {
  test("returns greeting for authenticated user", async () => {
    const spy = vi.spyOn(auth, "getAuthData");
    spy.mockImplementation(() => ({
      userID: "user-1",
      email: "demo@example.com",
      role: "user",
    }));

    const resp = await me();
    expect(resp.message).toBe("Hello demo@example.com!");

    spy.mockRestore();
  });
});
