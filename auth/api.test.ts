import { describe, expect, test, vi } from "vitest";
import * as auth from "~encore/auth";
import { profile } from "./api";

describe("profile", () => {
  test("returns profile for authenticated user", async () => {
    const spy = vi.spyOn(auth, "getAuthData");
    spy.mockImplementation(() => ({
      userID: "user-1",
      email: "demo@example.com",
      role: "user",
    }));

    const resp = await profile();
    expect(resp).toEqual({
      userID: "user-1",
      email: "demo@example.com",
      role: "user",
    });

    spy.mockRestore();
  });
});
