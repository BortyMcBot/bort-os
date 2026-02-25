import * as React from "react"
import { useDashboard } from "@/app/data"
import { Page } from "@/components/layout/page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

function DisabledActionButton({ children }: { children: React.ReactNode }) {
  return (
    <Button
      variant="secondary"
      disabled
      title="Requires approval"
      className="cursor-not-allowed opacity-70"
    >
      {children}
    </Button>
  )
}

export function ServicesPage() {
  const { loading, data } = useDashboard()

  return (
    <Page
      title="Services"
      right={<DisabledActionButton>Restart service</DisabledActionButton>}
    >
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">systemd --user</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead>PID</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.services.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={s.activeState === "active" ? "default" : "secondary"}
                          className={cn(
                            s.activeState === "active" &&
                              "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
                          )}
                        >
                          {s.activeState}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{s.subState}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.sincePhoenix ? s.sincePhoenix : "—"}
                      {s.sinceRelative ? ` (${s.sinceRelative})` : ""}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.execMainPid ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </SheetTrigger>
                        <SheetContent>
                          <SheetHeader>
                            <SheetTitle>{s.id}</SheetTitle>
                            <SheetDescription>{s.description || "—"}</SheetDescription>
                          </SheetHeader>
                          <div className="mt-6 space-y-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Active</span>
                              <span className="font-medium">
                                {s.activeState}/{s.subState}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Unit</span>
                              <span className="font-medium">{s.unitFileState || "—"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Since</span>
                              <span className="font-medium">
                                {s.sincePhoenix ? s.sincePhoenix : "—"}
                                {s.sinceRelative ? ` (${s.sinceRelative})` : ""}
                              </span>
                            </div>
                            <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                              Actions are disabled in v1. Tooltip: “Requires approval.”
                            </div>
                          </div>
                        </SheetContent>
                      </Sheet>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Page>
  )
}
