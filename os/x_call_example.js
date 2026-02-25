#!/usr/bin/env node

const { xCall } = require('./x_call');

(async () => {
  const r = await xCall({
    actionType: 'lookup',
    method: 'GET',
    endpoint: '/2/users/me',
    details: 'example users/me',
  });

  if (!r.ok && r.blocked) {
    console.log('blocked: blocked_by_budget');
    process.exit(1);
  }

  console.log(`status: ${r.status}`);
  process.exit(r.status === 200 ? 0 : 1);
})();
