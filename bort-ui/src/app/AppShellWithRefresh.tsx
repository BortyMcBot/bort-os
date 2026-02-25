import { AppShell } from "@/app/AppShell"
import { useDashboard } from "@/app/data"

export function AppShellWithRefresh() {
  const { refreshAll } = useDashboard()
  return <AppShell onRefresh={() => refreshAll().catch(() => void 0)} />
}
