import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/create-organization")({
  ssr: false,
  component: () => <Navigate to="/auth" search={{ mode: "signup", invite: undefined }} replace />,
});
