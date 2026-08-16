import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock supabase like smoke.test.tsx does — no network, no real DB
vi.mock("~/lib/supabase", () => ({
  fetchAllRoomsWithFrames: vi.fn().mockResolvedValue([]),
  createItem: vi.fn(),
  fetchTodoListsWithItems: vi.fn(),
  createTodoList: vi.fn(),
  updateTodoList: vi.fn(),
  deleteTodoList: vi.fn(),
  createTodoItem: vi.fn().mockResolvedValue(undefined),
  updateTodoItem: vi.fn(),
  deleteTodoItem: vi.fn(),
  reorderTodoItems: vi.fn(),
  reorderTodoLists: vi.fn(),
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

import { fetchTodoListsWithItems, createTodoItem, updateTodoList } from "~/lib/supabase";
import TodosPage from "~/routes/todos";

const LIST = {
  id: "list-1",
  name: "Groceries",
  color_index: 0,
  sort_order: 0,
  owner: null,
  created_at: "2026-01-01T00:00:00Z",
  items: [],
};

function renderTodos() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TodosPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function getAddInput(): Promise<HTMLTextAreaElement> {
  const el = await screen.findByPlaceholderText("Add a task...");
  return el as HTMLTextAreaElement;
}

describe("Todo add input (auto-growing textarea)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchTodoListsWithItems).mockResolvedValue([LIST]);
    localStorage.setItem("homebase_user", "brendan");
    localStorage.removeItem("homebase_active_list_brendan");
  });

  it("renders the add input as a textarea (multi-line capable)", async () => {
    renderTodos();
    const input = await getAddInput();
    expect(input.tagName).toBe("TEXTAREA");
  });

  it("Enter commits the task, prevents the default newline, and clears the input", async () => {
    renderTodos();
    const input = await getAddInput();

    fireEvent.change(input, { target: { value: "buy milk" } });
    // fireEvent returns false when preventDefault was called — in a real
    // browser that is what stops Enter from inserting a newline
    const defaultAllowed = fireEvent.keyDown(input, { key: "Enter" });

    expect(defaultAllowed).toBe(false);
    // react-query runs mutationFn on a microtask — wait for it
    await waitFor(() => expect(createTodoItem).toHaveBeenCalledTimes(1));
    expect(createTodoItem).toHaveBeenCalledWith(
      expect.objectContaining({ list_id: "list-1", text: "buy milk", sort_order: 0 })
    );
    expect(input).toHaveValue("");
  });

  it("Shift+Enter does not commit and lets the default newline through", async () => {
    renderTodos();
    const input = await getAddInput();

    fireEvent.change(input, { target: { value: "buy milk" } });
    const defaultAllowed = fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(defaultAllowed).toBe(true); // browser would insert the newline
    await new Promise((r) => setTimeout(r, 0)); // flush any scheduled mutation
    expect(createTodoItem).not.toHaveBeenCalled();
    expect(input).toHaveValue("buy milk");
  });

  it("Enter on empty or whitespace-only input commits nothing", async () => {
    renderTodos();
    const input = await getAddInput();

    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    // flush the microtask queue so a scheduled mutation would have run
    await new Promise((r) => setTimeout(r, 0));
    expect(createTodoItem).not.toHaveBeenCalled();
  });

  it("multi-line input splits into one task per line, stripping bullet prefixes", async () => {
    renderTodos();
    const input = await getAddInput();

    // What the input holds after Shift+Enter newlines / a multi-line paste
    fireEvent.change(input, { target: { value: "milk\n- eggs\n2. bread\n\n  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(createTodoItem).toHaveBeenCalledTimes(3));
    const texts = vi.mocked(createTodoItem).mock.calls.map(([row]) => row.text);
    expect(texts).toEqual(["milk", "eggs", "bread"]);
    const sortOrders = vi.mocked(createTodoItem).mock.calls.map(([row]) => row.sort_order);
    expect(sortOrders).toEqual([0, 1, 2]);
    expect(input).toHaveValue("");
  });

  it("auto-grow guard: keeps height 'auto' when scrollHeight is 0 (hidden / no layout)", async () => {
    // jsdom has no layout engine, so scrollHeight is always 0 — the same state
    // a real browser reports for a hidden textarea. The guard must leave the
    // natural rows=1 height instead of collapsing the element to 0px.
    renderTodos();
    const input = await getAddInput();

    fireEvent.change(input, { target: { value: "a fairly long task that would wrap" } });

    expect(input.style.height).toBe("auto");
    expect(input.style.height).not.toMatch(/px/);
  });

  it("list rename folds pasted newlines to spaces but keeps inner spacing as typed", async () => {
    renderTodos();
    await getAddInput(); // wait for lists to load

    fireEvent.doubleClick(await screen.findByText("Groceries"));
    const rename = document.querySelector(".todo-tab-rename") as HTMLTextAreaElement;
    expect(rename).toBeTruthy();

    // Newlines (from a paste) become single spaces; the doubled space survives
    fireEvent.change(rename, { target: { value: "Trader  Joe's\nrun" } });
    fireEvent.keyDown(rename, { key: "Enter" });

    await waitFor(() =>
      expect(updateTodoList).toHaveBeenCalledWith("list-1", { name: "Trader  Joe's run" })
    );
  });
});
