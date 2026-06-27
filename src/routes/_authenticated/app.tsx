import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useServerFn } from "@tanstack/react-query" as any;
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/app")({
  component: () => <Outlet />,
});

// (file replaced below)
void useQuery; void useServerFn; void useNavigate; void useEffect;
