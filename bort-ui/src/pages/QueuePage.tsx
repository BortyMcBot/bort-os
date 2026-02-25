import { useDashboard } from "@/app/data"
import { Page } from "@/components/layout/page"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function QueuePage() {
  const { loading, data } = useDashboard()

  const q = data.queue

  return (
    <Page title="Queue">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">X Post Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !q ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : q.xPostQueue.length ? (
              <ul className="space-y-2">
                {q.xPostQueue.slice(0, 60).map((item, idx) => (
                  <li key={idx} className="rounded-xl border bg-card/40 p-2 text-sm">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Empty queue.</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">X Queue (follow/digest)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !q ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : q.xQueue.length ? (
              <ul className="space-y-2">
                {q.xQueue.slice(0, 60).map((item, idx) => (
                  <li key={idx} className="rounded-xl border bg-card/40 p-2 text-sm">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Nothing queued.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  )
}
