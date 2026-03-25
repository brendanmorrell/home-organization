import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// Mock supabase to avoid env errors in tests
vi.mock("~/lib/supabase", () => ({
  fetchAllRoomsWithFrames: vi.fn().mockResolvedValue([]),
  createItem: vi.fn(),
}));

import TodosPage from "~/routes/todos";
import WeeklyPage from "~/routes/weekly";
import VehiclesPage from "~/routes/vehicles";
import DocsPage from "~/routes/docs";
import Sidebar from "~/components/Sidebar";
import BottomTabs from "~/components/BottomTabs";

describe("Stub pages", () => {
  it("TodosPage renders title", () => {
    render(
      <MemoryRouter>
        <TodosPage />
      </MemoryRouter>
    );
    expect(screen.getByText("To-dos")).toBeInTheDocument();
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });

  it("WeeklyPage renders title", () => {
    render(
      <MemoryRouter>
        <WeeklyPage />
      </MemoryRouter>
    );
    expect(screen.getByText("Weekly")).toBeInTheDocument();
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });

  it("VehiclesPage renders title", () => {
    render(
      <MemoryRouter>
        <VehiclesPage />
      </MemoryRouter>
    );
    expect(screen.getByText("Vehicles")).toBeInTheDocument();
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });

  it("DocsPage renders title", () => {
    render(
      <MemoryRouter>
        <DocsPage />
      </MemoryRouter>
    );
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });
});

describe("Sidebar", () => {
  it("renders nav items", () => {
    render(
      <MemoryRouter>
        <Sidebar
          rooms={[]}
          activeRoomId={null}
          setActiveRoomId={() => {}}
          totalItems={0}
        />
      </MemoryRouter>
    );
    expect(screen.getByText("HomeBase")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("House View")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("To-dos")).toBeInTheDocument();
  });
});

describe("BottomTabs", () => {
  it("renders 5 tabs", () => {
    render(
      <MemoryRouter>
        <BottomTabs />
      </MemoryRouter>
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("House")).toBeInTheDocument();
    expect(screen.getByText("Items")).toBeInTheDocument();
    expect(screen.getByText("Todos")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
  });
});
