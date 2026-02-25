import * as React from "react"
import { Outlet } from "react-router-dom"
import { Sidebar } from "@/components/nav/sidebar"
import { MobileNav } from "@/components/nav/mobile-nav"
import { AppHeader } from "@/components/layout/app-header"

export function AppShell({ onRefresh }: { onRefresh: () => void }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(120,119,198,0.22),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(2,132,199,0.16),transparent_60%)]" />

      <div className="flex">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

        <div className="min-w-0 flex-1">
          <AppHeader onRefresh={onRefresh} onOpenMobileNav={() => setMobileOpen(true)} />
          <main>
            <Outlet />
          </main>
        </div>
      </div>

      <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} />
    </div>
  )
}
