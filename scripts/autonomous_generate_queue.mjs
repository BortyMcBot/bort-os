#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const WORKSPACE = '/root/.openclaw/workspace'
const QUEUE_PATH = path.join(WORKSPACE, 'memory', 'autonomous_queue.json')

function nowPhoenix() {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  return dtf.format(new Date()).replace(',', '')
}

function seedQueue() {
  return {
    generatedAtPhoenix: nowPhoenix(),
    tasks: [
      {
        id: 'bort-os:secrets-policy',
        repo: 'bort-os',
        description: 'Add SECRETS.md with guardrails + update SECURITY.md references',
        priority: 'medium',
        prTitle: 'docs(security): add secrets handling policy',
      },
      {
        id: 'personal-website:now-section',
        repo: 'personal-website',
        description: 'Add simple “Now”/status section driven from config data',
        priority: 'medium',
        prTitle: 'feat(ui): add configurable “Now” section',
      },
    ],
  }
}

function main() {
  fs.mkdirSync(path.dirname(QUEUE_PATH), { recursive: true })
  const queue = seedQueue()
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n')
  console.log('autonomous queue generated')
}

main()
