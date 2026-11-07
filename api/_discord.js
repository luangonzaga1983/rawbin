const API = 'https://discord.com/api/v10';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function discord(path, opts = {}, tries = 0) {
  const headers = { Authorization: `Bot ${process.env.DISCORD_TOKEN}` };
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const r = await fetch(API + path, { ...opts, headers });
  if (r.status === 429 && tries < 8) {
    const d = await r.json().catch(() => ({}));
    await sleep((d.retry_after || 1) * 1000 + 100);
    return discord(path, opts, tries + 1);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    const e = new Error(`Discord ${r.status}: ${t}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

const channel = () => process.env.DISCORD_CHANNEL_ID;

module.exports = { discord, channel };
