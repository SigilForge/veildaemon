import { beforeEach, describe, expect, it, vi } from "vitest";
import { authReturnTarget } from "@/lib/config";

const { signInWithPassword } = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: async () => ({ auth: { signInWithPassword } }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
}));
import { login } from "@/app/(auth)/actions";

describe("VeilLink login intent", () => {
  beforeEach(() => signInWithPassword.mockResolvedValue({ error: null }));

  it.each([
    ["", "/home"],
    ["/home", "/home"],
    ["/book-one", "/book-one"],
    ["/rights/create", "/rights/create"],
    ["/account/rights", "/account/rights"],
    ["/dashboard", "/dashboard"],
    ["https://veildaemon.app/operator/", "https://veildaemon.app/operator/"],
    ["https://veildaemon.app/handler/live/?case=viridian", "https://veildaemon.app/handler/live/?case=viridian"],
  ])("returns %s to %s after successful authentication", async (next, expected) => {
    const form = new FormData();
    form.set("email", "routing@example.com");
    form.set("password", "test-password");
    form.set("next", next);
    expect(authReturnTarget(next)).toBe(expected);
    await expect(login(form)).rejects.toThrow(`redirect:${expected}`);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "routing@example.com", password: "test-password" });
  });

  it.each(["/home", "/book-one", "/rights/create", "/dashboard"])(
    "keeps failed authentication in its original intent: %s", async (next) => {
      signInWithPassword.mockResolvedValue({ error: { message: "Invalid credentials" } });
      const form = new FormData();
      form.set("next", next);
      const path = next === "/home" ? "/" : "/login";
      await expect(login(form)).rejects.toThrow(
        `redirect:${path}?error=Invalid%20credentials&next=${encodeURIComponent(next)}`,
      );
    },
  );
});
