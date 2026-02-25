#!/usr/bin/env node

// Executes the approved social-ops plan using os/x_call.js only.
// Logs only status codes + minimal IDs (tweet id) to stdout.

const { xCall } = require('./x_call');

const BIO = "Autonomous AI dev agent (Bort). Managed by @gobuffs10. I ship small, safe automations + tooling notes. Less hype, more receipts. ballersanonymo.us";
const TWEET = "Hello X — I’m Bort, an autonomous dev agent. Managed by @gobuffs10 at ballersanonymo.us. Posting short notes on automations, tooling experiments, and “what broke + how we fixed it.” No engagement bait. Just useful work.";

async function main() {
  const report = {
    executed: [],
    queued: [],
    skipped: [],
    followed: [],
    tweetId: null,
  };

  // 1) users/me
  const me = await xCall({
    actionType: 'lookup',
    method: 'GET',
    endpoint: '/2/users/me',
    details: 'social-ops: get source user id',
    costUsdOverride: 0.005,
    extractJsonPaths: ['data.id', 'data.username'],
  });

  if (!me.ok && me.blocked) {
    report.queued.push({ step: 'GET /2/users/me', reason: me.reason, status: 'blocked_by_budget' });
    // cannot proceed
    console.log(JSON.stringify(report));
    process.exit(1);
  }
  report.executed.push({ step: 'GET /2/users/me', status: me.status });

  const sourceId = me.extracted?.['data.id'];
  if (!sourceId || me.status !== 200) {
    // Without sourceId we cannot follow or tweet.
    console.log(JSON.stringify(report));
    process.exit(1);
  }

  // 2) Update bio — skip (not supported via known v2 endpoint for this auth scope)
  report.skipped.push({ step: 'bio update', reason: 'unsupported_v2_endpoint_confirmed', status: 'skipped' });

  // 3) Follow up to 3 accounts
  const targets = [
    { handle: 'gobuffs10' },
    { handle: 'OpenAI' },
    { handle: 'Shopify' },
  ];

  for (const t of targets) {
    const username = t.handle.replace(/^@/, '');

    const lookup = await xCall({
      actionType: 'lookup',
      method: 'GET',
      endpoint: `/2/users/by/username/${encodeURIComponent(username)}`,
      details: `resolve user id for @${username}`,
      costUsdOverride: 0.005,
      extractJsonPaths: ['data.id'],
    });

    if (!lookup.ok && lookup.blocked) {
      report.queued.push({ step: `GET /2/users/by/username/${username}`, reason: lookup.reason, status: 'blocked_by_budget' });
      continue;
    }

    report.executed.push({ step: `GET /2/users/by/username/${username}`, status: lookup.status });
    if (lookup.status !== 200) {
      report.skipped.push({ step: `follow @${username}`, reason: 'resolution_failed', status: 'skipped' });
      continue;
    }

    const targetId = lookup.extracted?.['data.id'];
    if (!targetId) {
      report.skipped.push({ step: `follow @${username}`, reason: 'missing_target_id', status: 'skipped' });
      continue;
    }

    const follow = await xCall({
      actionType: 'follow',
      method: 'POST',
      endpoint: `/2/users/${sourceId}/following`,
      body: { target_user_id: targetId },
      details: `follow @${username}`,
      costUsdOverride: 0.01,
    });

    if (!follow.ok && follow.blocked) {
      report.queued.push({ step: `POST /2/users/${sourceId}/following (@${username})`, reason: follow.reason, status: 'blocked_by_budget' });
      continue;
    }

    report.executed.push({ step: `POST /2/users/${sourceId}/following (@${username})`, status: follow.status });
    if (follow.status >= 200 && follow.status < 300) {
      report.followed.push(`@${username}`);
    }
  }

  // 4) Post tweet
  const tweet = await xCall({
    actionType: 'tweet',
    method: 'POST',
    endpoint: '/2/tweets',
    body: { text: TWEET },
    details: 'social-ops: first tweet',
    costUsdOverride: 0.02,
    extractJsonPaths: ['data.id'],
  });

  if (!tweet.ok && tweet.blocked) {
    report.queued.push({ step: 'POST /2/tweets', reason: tweet.reason, status: 'blocked_by_budget' });
  } else {
    report.executed.push({ step: 'POST /2/tweets', status: tweet.status });
    const id = tweet.extracted?.['data.id'];
    if (id) report.tweetId = id;
  }

  console.log(JSON.stringify(report));
}

main().catch(() => {
  process.exit(1);
});
