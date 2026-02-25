export type Service = {
  ok: boolean
  id: string
  description?: string
  unitFileState?: string
  activeState?: string
  subState?: string
  execMainPid?: number | null
  sincePhoenix?: string | null
  sinceRelative?: string | null
}

export type Artifact = {
  key: string
  path?: string
  size?: number
  mtimePhoenix?: string
  mtimeRelative?: string | null
  missing?: boolean
}

export type LogFile = {
  filename: string
  size?: number
  mtimePhoenix?: string
  mtimeRelative?: string | null
  missing?: boolean
}

export type QueueData = {
  xPostQueue: string[]
  xQueue: string[]
}

export type ResultsData = {
  results: { title: string; lines: string[] }[]
}

export type DigestData = {
  previewLines: string[]
  state: any
}
