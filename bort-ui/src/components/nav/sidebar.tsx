import * as React from "react"
import { NavLink } from "react-router-dom"
import { NAV_ITEMS } from "@/components/nav/nav-items"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDashboard } from "@/app/data"

function StatusDot({ state }: { state: "good" | "warn" | "bad" | "unknown" }) {
  const cls =
    state === "good"
      ? "bg-emerald-500"
      : state === "warn"
        ? "bg-amber-500"
        : state === "bad"
          ? "bg-rose-500"
          : "bg-muted-foreground/50"
  return <span className={cn("h-2.5 w-2.5 rounded-full", cls)} />
}

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const { data } = useDashboard()

  const gateway = data.services.find((s) => s.id === "openclaw-gateway.service")
  const gatewayState: "good" | "warn" | "bad" | "unknown" =
    gateway?.activeState === "active"
      ? "good"
      : gateway?.activeState === "activating"
        ? "warn"
        : gateway?.activeState
          ? "bad"
          : "unknown"

  const queueDepth = (data.queue?.xPostQueue?.length || 0) + (data.queue?.xQueue?.length || 0)

  return (
    <aside
      className={cn(
        "relative hidden h-screen shrink-0 border-r bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40 md:flex md:flex-col",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex items-center gap-3 px-3 py-3", collapsed && "justify-center")}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/80 to-cyan-500/70 shadow">
          <Shield className="h-5 w-5" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">Bort Control Panel</div>
            <div className="truncate text-xs text-muted-foreground">read-only v1</div>
          </div>
        ) : null}

        <div className={cn("ml-auto", collapsed && "hidden")}>
          <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <nav className={cn("mt-2 flex flex-1 flex-col gap-1 px-2", collapsed && "px-1")}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isServices = item.to === "/services"
          const isQueue = item.to === "/queue"

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground",
                  "hover:bg-accent/40 hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive && "bg-accent/50 text-foreground",
                  collapsed && "justify-center px-2",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />

              {!collapsed ? (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate">{item.title}</span>
                  <div className="flex items-center gap-2">
                    {isServices ? <StatusDot state={gatewayState} /> : null}
                    {isQueue && queueDepth ? (
                      <Badge variant="secondary" className="tabular-nums">
                        {queueDepth}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ) : (
                <span className="sr-only">{item.title}</span>
              )}
            </NavLink>
          )
        })}

        {collapsed ? (
          <div className="mt-2 flex justify-center">
            <Button variant="ghost" size="icon" onClick={onToggle} className="h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </nav>

      <div className={cn("border-t p-3", collapsed && "hidden")}>
        <div className="text-xs text-muted-foreground">All times: Phoenix</div>
      </div>
    </aside>
  )
}
