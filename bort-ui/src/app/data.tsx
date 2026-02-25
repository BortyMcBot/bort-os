import * as React from "react"
import { apiGet } from "@/app/api"
import type { Artifact, DigestData, LogFile, QueueData, ResultsData, Service } from "@/app/types"

export type DashboardData = {
  services: Service[]
  artifacts: Artifact[]
  logs: LogFile[]
  defaultLog: string | null
  queue: QueueData | null
  results: ResultsData | null
  digest: DigestData | null
}

type DashboardContextValue = {
  loading: boolean
  data: DashboardData
  refreshAll: (opts?: { silent?: boolean }) => Promise<void>
}

const DashboardContext = React.createContext<DashboardContextValue | null>(null)

export function useDashboard() {
  const v = React.useContext(DashboardContext)
  if (!v) throw new Error("useDashboard must be used within DashboardProvider")
  return v
}

const EMPTY: DashboardData = {
  services: [],
  artifacts: [],
  logs: [],
  defaultLog: null,
  queue: null,
  results: null,
  digest: null,
}

export function DashboardProvider({
  children,
  onRefreshed,
  onRefreshFailed,
}: {
  children: React.ReactNode
  onRefreshed?: () => void
  onRefreshFailed?: (err: unknown) => void
}) {
  const [loading, setLoading] = React.useState(true)
  const [data, setData] = React.useState<DashboardData>(EMPTY)

  const refreshAll = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        setLoading(true)
        const [svc, art, logList, q, r, d] = await Promise.all([
          apiGet<{ services: Service[] }>("/api/services"),
          apiGet<{ artifacts: Artifact[] }>("/api/artifacts"),
          apiGet<{ files: LogFile[]; default: string | null }>("/api/logs"),
          apiGet<QueueData>("/api/queue"),
          apiGet<ResultsData>("/api/results"),
          apiGet<DigestData>("/api/digest"),
        ])

        setData({
          services: svc.services,
          artifacts: art.artifacts,
          logs: logList.files,
          defaultLog: logList.default,
          queue: q,
          results: r,
          digest: d,
        })

        if (!opts?.silent) onRefreshed?.()
      } catch (e) {
        onRefreshFailed?.(e)
      } finally {
        setLoading(false)
      }
    },
    [onRefreshed, onRefreshFailed],
  )

  React.useEffect(() => {
    refreshAll({ silent: true }).catch(() => void 0)
  }, [refreshAll])

  return (
    <DashboardContext.Provider value={{ loading, data, refreshAll }}>
      {children}
    </DashboardContext.Provider>
  )
}
