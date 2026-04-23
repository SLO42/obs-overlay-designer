import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TipRoute } from "../TipRoute";

/**
 * Tests for the public /tip/:slug route. We mock `@obs/supabase-client` to
 * substitute the Supabase client + edge-function callers, but keep the
 * real `fees.ts` so the total/streamer-net math is exercised end-to-end.
 */

const mockStreamer = {
  slug: "saucy",
  twitch_login: "saucyenchiladas",
  display_name: "Saucy Enchiladas",
  stripe_charges_enabled: true,
};

// Programmable stubs — tests flip these before each render.
const state: {
  env: { url: string; anonKey: string } | null;
  row: typeof mockStreamer | null;
  rowError: Error | null;
  createCheckoutSessionMock: ReturnType<typeof vi.fn>;
} = {
  env: { url: "https://test.supabase.co", anonKey: "anon" },
  row: mockStreamer,
  rowError: null,
  createCheckoutSessionMock: vi.fn(),
};

vi.mock("@obs/supabase-client", async (importOriginal) => {
  // Keep `fees.ts` real so we don't drift from the authoritative math.
  const actual = await importOriginal<typeof import("@obs/supabase-client")>();
  return {
    ...actual,
    readSupabasePublicConfig: () => state.env,
    createSupabaseClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (state.rowError) return { data: null, error: state.rowError };
              return { data: state.row, error: null };
            },
          }),
        }),
      }),
    }),
    callCreateCheckoutSession: (...args: unknown[]) => state.createCheckoutSessionMock(...args),
  };
});

function renderRoute(slug = "saucy", search = ""): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[`/tip/${slug}${search}`]}>
      <Routes>
        <Route path="/tip/:slug" element={<TipRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.env = { url: "https://test.supabase.co", anonKey: "anon" };
  state.row = mockStreamer;
  state.rowError = null;
  state.createCheckoutSessionMock = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TipRoute", () => {
  it("renders the 'not configured' state when Supabase env is missing", async () => {
    state.env = null;
    renderRoute();
    expect(await screen.findByText(/tips aren.?t configured yet/i)).toBeTruthy();
  });

  it("renders the 'streamer not found' state when the row is missing", async () => {
    state.row = null;
    renderRoute("nosuch");
    expect(await screen.findByText(/streamer not found/i)).toBeTruthy();
  });

  it("renders the form when the streamer exists and charges are enabled", async () => {
    renderRoute();
    expect(await screen.findByText(/tip @saucyenchiladas/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /pay with card/i })).toBeTruthy();
    expect(screen.getByLabelText(/tip amount/i)).toBeTruthy();
  });

  it("renders the 'not accepting tips' state when charges are disabled", async () => {
    state.row = { ...mockStreamer, stripe_charges_enabled: false };
    renderRoute();
    expect(await screen.findByText(/isn.?t accepting tips yet/i)).toBeTruthy();
  });

  it("does not surface the fee breakdown to the viewer", async () => {
    renderRoute();
    await screen.findByRole("button", { name: /pay with card/i });
    // No breakdown panel; the viewer only sees the amount they typed.
    expect(screen.queryByTestId("tip-totals")).toBeNull();
    expect(screen.queryByText(/streamer gets/i)).toBeNull();
    expect(screen.queryByText(/Stripe processing/i)).toBeNull();
    // Terms link is present so the fee disclosure path exists.
    expect(screen.getByRole("link", { name: /terms/i })).toBeTruthy();
  });

  it("submit invokes callCreateCheckoutSession and redirects to the returned URL", async () => {
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: { ...window.location, assign: assignMock } as unknown as Location,
    });
    state.createCheckoutSessionMock = vi.fn(async () => ({ url: "https://stripe/test" }));

    const user = userEvent.setup();
    renderRoute();
    await screen.findByRole("button", { name: /pay with card/i });
    await user.click(screen.getByRole("button", { name: /pay with card/i }));

    await waitFor(() => {
      expect(state.createCheckoutSessionMock).toHaveBeenCalledTimes(1);
    });
    const args = state.createCheckoutSessionMock.mock.calls[0]![1] as Record<string, unknown>;
    expect(args.slug).toBe("saucy");
    expect(args.totalCents).toBe(300);
    expect(args.currency).toBe("usd");
    // The cover-fees concept is gone; viewer pays what they type.
    expect(args).not.toHaveProperty("coverFees");
    expect(args).not.toHaveProperty("netCents");
    expect(assignMock).toHaveBeenCalledWith("https://stripe/test");
  });

  it("disables submit when the message exceeds 200 characters", async () => {
    const user = userEvent.setup();
    renderRoute();
    const textarea = (await screen.findByLabelText(/message \(optional/i)) as HTMLTextAreaElement;
    await user.click(textarea);
    // Paste past the limit in one go so the test stays fast.
    await user.paste("x".repeat(201));
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /pay with card/i }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  it("shows the thank-you banner (and no form) when ?status=success is present", async () => {
    renderRoute("saucy", "?status=success");
    expect(await screen.findByText(/thanks for supporting @saucyenchiladas/i)).toBeTruthy();
    // The form shouldn't be rendered.
    expect(screen.queryByRole("button", { name: /pay with card/i })).toBeNull();
  });
});
