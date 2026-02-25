import { Link } from "react-router-dom"
import { Page } from "@/components/layout/page"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <Page title="Not found">
      <div className="rounded-xl border bg-card/40 p-6 text-sm text-muted-foreground">
        That route doesn’t exist.
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to="/">Back to Overview</Link>
          </Button>
        </div>
      </div>
    </Page>
  )
}
