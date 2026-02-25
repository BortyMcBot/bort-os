import * as React from "react"
import { useDashboard } from "@/app/data"
import { Page } from "@/components/layout/page"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card className="bg-card/60 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
        {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  )
}

export function OverviewPage() {
  const { loading, data } = useDashboard()

  const gateway = data.services.find((s) => s.id === "openclaw-gateway.service")
  const queueDepth = (data.queue?.xPostQueue?.length || 0) + (data.queue?.xQueue?.length || 0)
  const ledger = data.artifacts.find((a) => a.key === "x_budget_ledger.json")

  return (
    <Page title="Overview">
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi
          label="Gateway"
          value={
            loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant={gateway?.activeState === "active" ? "default" : "secondary"}>
                  {gateway?.activeState || "unknown"}
                </Badge>
                <span className="text-sm text-muted-foreground">{gateway?.subState || ""}</span>
              </div>
            )
          }
          sub={
            loading ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <span>
                {gateway?.sincePhoenix ? gateway.sincePhoenix : "—"}
                {gateway?.sinceRelative ? ` (${gateway.sinceRelative})` : ""}
              </span>
            )
          }
        />

        <Kpi
          label="Queue depth"
          value={loading ? <Skeleton className="h-8 w-20" /> : <span>{queueDepth}</span>}
          sub={loading ? <Skeleton className="h-4 w-36" /> : "x_post_queue + x_queue"}
        />

        <Kpi
          label="Budget ledger"
          value={loading ? <Skeleton className="h-8 w-28" /> : <span className="text-sm">read-only</span>}
          sub={
            loading ? (
              <Skeleton className="h-4 w-44" />
            ) : ledger?.missing ? (
              "Ledger missing"
            ) : ledger ? (
              <span>
                Updated: {ledger.mtimePhoenix}
                {ledger.mtimeRelative ? ` (${ledger.mtimeRelative})` : ""}
              </span>
            ) : (
              "Ledger: unknown"
            )
          }
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Digest</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : data.digest?.previewLines?.length ? (
              <div className="space-y-1 rounded-xl border bg-card/40 p-3 font-mono text-xs leading-relaxed">
                {data.digest.previewLines.slice(0, 12).map((l, i) => (
                  <div key={i} className="text-muted-foreground">
                    {l}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No digest data.</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Recent results</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : data.results?.results?.length ? (
              <ul className="space-y-2">
                {data.results.results.slice(0, 8).map((b, idx) => (
                  <li key={idx} className="rounded-xl border bg-card/40 p-3">
                    <div className="font-medium">{b.title}</div>
                    {b.lines?.length ? (
                      <div className="mt-2 text-sm text-muted-foreground line-clamp-2">{b.lines.join(" ")}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No results yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  )
}
