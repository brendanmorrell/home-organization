import { type RouteConfig, route, layout } from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    route("/", "routes/dashboard.tsx"),
    route("/house", "routes/house.tsx"),
    route("/rooms/:roomId", "routes/room-detail.tsx"),
    route("/inventory", "routes/inventory.tsx"),
    route("/todos", "routes/todos.tsx"),
    route("/weekly", "routes/weekly.tsx"),
    route("/vehicles", "routes/vehicles.tsx"),
    route("/docs", "routes/docs.tsx"),
    route("/admin", "routes/admin.tsx"),
    route("/plan", "routes/plan.tsx"),
  ]),
] satisfies RouteConfig;
