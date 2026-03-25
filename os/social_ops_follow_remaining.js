#!/usr/bin/env node

// Follow up to 3 accounts/hour from a provided ordered list.
// MUST use os/x_call.js for all X calls.
// Queues the remainder to memory/x_queue.md (reason=rate_limited_hourly).
// Prints status codes only.

const fs = require('fs');
const path = require('path');
const { xCall } = require('./x_call');
const xb = require('./x_budget');

const LOOKUP_COST = 0.005;
const FOLLOW_COST = 0.01;
const DEFAULT_CONFIG = {
  hourlyCap: 3,
  targets: ['remix_run', 'reactjs', 'vercel', 'CloudflareDev', 'github', 'PostHog'],
};

function loadConfig() {
  try {
    const p = path.join(__dirname, 'social_ops_follow_remaining.json');
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    return {
      hourlyCap: Number.isInteger(cfg?.hourlyCap) ? cfg.hourlyCap : DEFAULT_CONFIG.hourlyCap,
      targets: Array.isArray(cfg?.targets) && cfg.targets.length ? cfg.targets : DEFAULT_CONFIG.targets,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function main() {
  const { hourlyCap, targets } = loadConfig();

  // Get source user id
  const me = await xCall({
    actionType: 'lookup',
    method: 'GET',
    endpoint: '/2/users/me',
    details: 'social-ops: get source user id for follows',
    costUsdOverride: LOOKUP_COST,
    extractJsonPaths: ['data.id'],
  });

  if (!me.ok && me.blocked) {
    console.log('GET /2/users/me: blocked_by_budget');
    return;
  }
  console.log(`GET /2/users/me: ${me.status}`);

  const sourceId = me.extracted?.['data.id'];
  if (!sourceId || me.status !== 200) {
    // Cannot proceed
    return;
  }

  let followsThisHour = 0;

  for (let i = 0; i < targets.length; i++) {
    const username = targets[i];

    if (followsThisHour >= hourlyCap) {
      // Queue the rest for next hour
      xb.ensureQueueFile();
      for (let j = i; j < targets.length; j++) {
        const u = targets[j];
        xb.queueAction({
          reason: 'rate_limited_hourly',
          actionType: 'follow',
          method: 'POST',
          endpoint: `/2/users/${sourceId}/following`,
          estimateUsd: LOOKUP_COST + FOLLOW_COST,
          details: `queue for next hour: resolve then follow @${u}`,
        });
      }
      console.log(`queued_for_next_hour: ${targets.length - i}`);
      break;
    }

    // Resolve username
    const lookup = await xCall({
      actionType: 'lookup',
      method: 'GET',
      endpoint: `/2/users/by/username/${encodeURIComponent(username)}`,
      details: `resolve user id for @${username}`,
      costUsdOverride: LOOKUP_COST,
      extractJsonPaths: ['data.id'],
    });

    if (!lookup.ok && lookup.blocked) {
      console.log(`GET /2/users/by/username/${username}: blocked_by_budget`);
      continue;
    }
    console.log(`GET /2/users/by/username/${username}: ${lookup.status}`);

    if (lookup.status !== 200) {
      console.log(`FOLLOW @${username}: skipped_resolution_failed`);
      continue;
    }

    const targetId = lookup.extracted?.['data.id'];
    if (!targetId) {
      console.log(`FOLLOW @${username}: skipped_missing_target_id`);
      continue;
    }

    const follow = await xCall({
      actionType: 'follow',
      method: 'POST',
      endpoint: `/2/users/${sourceId}/following`,
      body: { target_user_id: targetId },
      details: `follow @${username}`,
      costUsdOverride: FOLLOW_COST,
    });

    if (!follow.ok && follow.blocked) {
      console.log(`POST /2/users/${sourceId}/following (@${username}): blocked_by_budget`);
      continue;
    }
    console.log(`POST /2/users/${sourceId}/following (@${username}): ${follow.status}`);

    if (follow.status >= 200 && follow.status < 300) {
      followsThisHour += 1;
    }
  }
}

main().catch(() => process.exit(1));
