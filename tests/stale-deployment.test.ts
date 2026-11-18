import { describe, expect, it, vi } from "vitest";
import {
  isStaleDeploymentError,
  reloadOnceForStaleDeployment,
  STALE_RELOAD_KEY,
} from "@/lib/stale-deployment";

function memoryStorage(seed: Record<string, string> = {}) {
  const data = { ...seed };
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    data,
  };
}

const named = (name: string, message: string) => Object.assign(new Error(message), { name });

describe("deployment skew (#1664)", () => {
  it("recognises the framework's and the browser's skew errors", () => {
    expect(
      isStaleDeploymentError(
        new Error('Server Action "7f3a" was not found on the server. \nRead more'),
      ),
    ).toBe(true);
    expect(
      isStaleDeploymentError(
        new Error(
          "Failed to find Server Action. This request might be from an older or newer deployment.",
        ),
      ),
    ).toBe(true);
    expect(isStaleDeploymentError(named("ChunkLoadError", "Loading chunk 123 failed."))).toBe(true);
    expect(isStaleDeploymentError(new Error("Loading CSS chunk 9 failed"))).toBe(true);
  });

  it("leaves every other error alone, including redacted server render errors", () => {
    expect(
      isStaleDeploymentError(new Error("An error occurred in the Server Components render.")),
    ).toBe(false);
    expect(isStaleDeploymentError(new Error("Network connection lost."))).toBe(false);
    expect(isStaleDeploymentError("not an error")).toBe(false);
  });

  it("reloads once for a skew error and records when", () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    expect(
      reloadOnceForStaleDeployment(named("ChunkLoadError", "x"), {
        storage,
        reload,
        now: () => 100_000,
      }),
    ).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.data[STALE_RELOAD_KEY]).toBe("100000");
  });

  it("does not reload again within the window, so it can never loop", () => {
    const storage = memoryStorage({ [STALE_RELOAD_KEY]: "100000" });
    const reload = vi.fn();
    expect(
      reloadOnceForStaleDeployment(named("ChunkLoadError", "x"), {
        storage,
        reload,
        now: () => 110_000,
      }),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(
      reloadOnceForStaleDeployment(named("ChunkLoadError", "x"), {
        storage,
        reload,
        now: () => 200_000,
      }),
    ).toBe(true);
  });

  it("does not reload for a non-skew error, or when storage throws", () => {
    const reload = vi.fn();
    expect(
      reloadOnceForStaleDeployment(new Error("boom"), { storage: memoryStorage(), reload }),
    ).toBe(false);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    };
    expect(
      reloadOnceForStaleDeployment(named("ChunkLoadError", "x"), { storage: broken, reload }),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
