import { execFileSync } from "node:child_process"

const PORTS = [18888, 18790]

function pidsForPort(port) {
  try {
    const out = execFileSync(
      "lsof",
      ["-n", "-P", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"],
      { encoding: "utf8" },
    )
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0)
  } catch {
    return []
  }
}

function isListening(pid, port) {
  const pids = new Set(pidsForPort(port))
  return pids.has(pid)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function freePort(port) {
  const pids = Array.from(new Set(pidsForPort(port)))
  if (!pids.length) return

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM")
      console.log(`[free-ports] SIGTERM pid=${pid} port=${port}`)
    } catch {
      // ignore
    }
  }

  await sleep(500)

  for (const pid of pids) {
    try {
      if (isListening(pid, port)) {
        process.kill(pid, "SIGKILL")
        console.log(`[free-ports] SIGKILL pid=${pid} port=${port}`)
      }
    } catch {
      // ignore
    }
  }
}

for (const port of PORTS) {
  // eslint-disable-next-line no-await-in-loop
  await freePort(port)
}
