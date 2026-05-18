#!/usr/bin/env node
// Feed health monitor — checks if feed JSON is stale

const MAX_HOURS = 36;

async function checkHealth() {
  const urls = [
    'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json',
    'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (!res.ok) { console.error(`⚠️ Feed unreachable: ${url.split('/').pop()} (HTTP ${res.status})`); continue; }
      const lastMod = res.headers.get('last-modified');
      if (lastMod) {
        const age = (Date.now() - new Date(lastMod).getTime()) / (1000 * 60 * 60);
        const name = url.split('/').pop();
        if (age > MAX_HOURS) console.log(`⚠️ Stale: ${name} (${age.toFixed(0)}h ago)`);
        else console.log(`✓ OK: ${name} (${age.toFixed(1)}h ago)`);
      }
    } catch (e) { console.error(`⚠️ Cannot reach feed: ${e.message}`); }
  }
}

checkHealth();
