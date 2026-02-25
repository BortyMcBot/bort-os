import * as React from "react"
import { Routes, Route } from "react-router-dom"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { DashboardProvider } from "@/app/data"
import { AppShellWithRefresh } from "@/app/AppShellWithRefresh"

import { OverviewPage } from "@/pages/OverviewPage"
import { ServicesPage } from "@/pages/ServicesPage"
import { QueuePage } from "@/pages/QueuePage"
import { ResultsPage } from "@/pages/ResultsPage"
import { DigestPage } from "@/pages/DigestPage"
import { LogsPage } from "@/pages/LogsPage"
import { NotFoundPage } from "@/pages/NotFoundPage"

export default function App() {
  const { toast } = useToast()

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <DashboardProvider
        onRefreshed={() => toast({ title: "Refreshed", description: "Dashboard data updated." })}
        onRefreshFailed={(e: any) =>
          toast({ title: "Refresh failed", description: e?.message || "Unknown", variant: "destructive" })
        }
      >
        <Routes>
          <Route
            path="/"
            element={<AppShellWithRefresh />}
          >
            {/* This inner shell gets refresh from context via a small wrapper */}
            <Route index element={<OverviewPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="queue" element={<QueuePage />} />
            <Route path="results" element={<ResultsPage />} />
            <Route path="digest" element={<DigestPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </DashboardProvider>
      <Toaster />
    </ThemeProvider>
  )
}
