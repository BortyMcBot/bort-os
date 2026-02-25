import * as React from "react"

export function Page({
  title,
  children,
  right,
}: {
  title: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        </div>
        {right ? <div className="pt-1">{right}</div> : null}
      </div>
      {children}
    </div>
  )
}
