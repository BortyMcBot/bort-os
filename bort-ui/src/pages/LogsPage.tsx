import * as React from "react"
import { apiGet } from "@/app/api"
import { useDashboard } from "@/app/data"
import { Page } from "@/components/layout/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Copy, Filter } from "lucide-react"

export function LogsPage() {
  const { loading, data } = useDashboard()

  const [selectedLog, setSelectedLog] = React.useState<string | null>(null)
  const [logLines, setLogLines] = React.useState<string[]>([])
  const [tail, setTail] = React.useState<number>(500)
  const [grep, setGrep] = React.useState<string>("")
  const [selected, setSelected] = React.useState<Set<number>>(() => new Set())

  React.useEffect(() => {
    if (!selectedLog && data.defaultLog) setSelectedLog(data.defaultLog)
  }, [data.defaultLog, selectedLog])

  const refresh = React.useCallback(async () => {
    if (!selectedLog) return
    const qs = new URLSearchParams()
    qs.set("tail", String(tail))
    if (grep.trim()) qs.set("grep", grep.trim())
    const resp = await apiGet<{ lines: string[] }>(`/api/logs/${encodeURIComponent(selectedLog)}?${qs.toString()}`)
    setLogLines(resp.lines)
    setSelected(new Set())
  }, [grep, selectedLog, tail])

  React.useEffect(() => {
    refresh().catch(() => void 0)
  }, [refresh, selectedLog])

  const copySelected = async () => {
    const indices = Array.from(selected).sort((a, b) => a - b)
    const text = indices.length ? indices.map((i) => logLines[i]).join("\n") : logLines.join("\n")
    await navigator.clipboard.writeText(text)
  }

  return (
    <Page
      title="Logs"
      right={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refresh()}>
            <Filter className="h-4 w-4" />
            Apply
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => copySelected().catch(() => void 0)}
            disabled={!logLines.length}
            title={selected.size ? "Copy selected lines" : "Copy all lines"}
          >
            <Copy className="h-4 w-4" />
            Copy
          </Button>
        </div>
      }
    >
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Runtime Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <div className="text-sm font-medium">Log file</div>
              <div className="mt-2">
                <Select value={selectedLog || undefined} onValueChange={(v) => setSelectedLog(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a log" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.logs.map((f) => (
                      <SelectItem key={f.filename} value={f.filename}>
                        {f.filename}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4 space-y-2">
                <div className="text-xs text-muted-foreground">Tail lines</div>
                <Select value={String(tail)} onValueChange={(v) => setTail(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[200, 500, 1000, 2000].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="text-xs text-muted-foreground">Grep contains</div>
                <input
                  value={grep}
                  onChange={(e) => setGrep(e.target.value)}
                  placeholder="e.g. ERROR"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="mt-4 text-xs text-muted-foreground">
                Tip: click lines to select; Copy copies selection (or all if none selected).
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="rounded-xl border bg-black/40 p-3 font-mono text-xs leading-relaxed">
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ) : !logLines.length ? (
                  <div className="rounded-lg border border-dashed bg-card/20 p-6 text-sm text-muted-foreground">
                    No log lines.
                  </div>
                ) : (
                  <div className="max-h-[620px] overflow-auto">
                    {logLines.map((line, idx) => {
                      const active = selected.has(idx)
                      return (
                        <div
                          key={idx}
                          onClick={() =>
                            setSelected((s) => {
                              const next = new Set(s)
                              if (next.has(idx)) next.delete(idx)
                              else next.add(idx)
                              return next
                            })
                          }
                          className={cn(
                            "cursor-default whitespace-pre-wrap rounded px-2 py-1",
                            "hover:bg-white/5",
                            active && "bg-indigo-500/20 ring-1 ring-indigo-500/30",
                          )}
                        >
                          <span className="select-none text-muted-foreground/60">{String(idx + 1).padStart(4, "0")} </span>
                          {line}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Page>
  )
}
