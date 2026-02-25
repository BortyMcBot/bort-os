import { useDashboard } from "@/app/data"
import { Page } from "@/components/layout/page"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function DigestPage() {
  const { loading, data } = useDashboard()
  const d = data.digest

  return (
    <Page title="Digest">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Digest Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {loading || !d ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : d.previewLines.length ? (
            <div className="rounded-xl border bg-black/40 p-3 font-mono text-xs leading-relaxed">
              <div className="max-h-[520px] overflow-auto whitespace-pre-wrap">
                {d.previewLines.join("\n")}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No digest output.</div>
          )}
        </CardContent>
      </Card>
    </Page>
  )
}
