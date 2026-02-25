import { useDashboard } from "@/app/data"
import { Page } from "@/components/layout/page"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function ResultsPage() {
  const { loading, data } = useDashboard()
  const r = data.results

  return (
    <Page title="Results">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Recent Post Results</CardTitle>
        </CardHeader>
        <CardContent>
          {loading || !r ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : r.results.length ? (
            <div className="space-y-3">
              {r.results.slice(0, 30).map((b, idx) => (
                <div key={idx} className="rounded-xl border bg-card/40 p-3 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{b.title}</div>
                    <Badge variant="secondary">result</Badge>
                  </div>
                  {b.lines?.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {b.lines.slice(0, 8).map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No results yet.</div>
          )}
        </CardContent>
      </Card>
    </Page>
  )
}
