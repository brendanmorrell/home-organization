import { type RouteConfig, route, layout } from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    route("/", "routes/home.tsx"),
    route("/rooms/:roomId", "routes/room-detail.tsx"),
    route("/admin", "routes/admin.tsx"),
  ]),
] satisfies RouteConfig;
