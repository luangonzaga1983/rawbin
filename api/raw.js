const { discord, channel } = require('./_discord');

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const unwrap = (c) => c.replace(/^```\n?/, '').replace(/\n?```$/, '');

module.exports = async (req, res) => {
  try {
    const id = String(req.query.id || '');
    if (!/^\d{15,25}$/.test(id)) return res.status(404).send('não encontrado');

    const idx = await discord(`/channels/${channel()}/messages/${id}`);
    if (!idx.content.startsWith('RAW-INDEX ')) return res.status(404).send('não encontrado');
    const ids = JSON.parse(idx.content.slice(10)).c;

    // busca em lote os pedaços (1 request na maioria dos casos)
    const map = {};
    const min = ids.reduce((a, b) => (BigInt(a) < BigInt(b) ? a : b));
    const bulk = await discord(
      `/channels/${channel()}/messages?after=${BigInt(min) - 1n}&limit=100`
    );
    for (const m of bulk) map[m.id] = m.content;
    // o que faltou (mensagens de outros raws no meio) busca individual
    for (const cid of ids) {
      if (map[cid] === undefined) {
        const m = await discord(`/channels/${channel()}/messages/${cid}`);
        map[cid] = m.content;
      }
    }

    const text = ids.map((cid) => unwrap(map[cid])).join('');

    // conteúdo nunca muda -> cache longo na Vercel (poupa o Discord)
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, max-age=3600, immutable');

    if (req.query.mode === 'plain') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(text);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>raw</title>
<style>html,body{margin:0;background:#000;color:#fff}
pre{margin:0;padding:12px;font:14px/1.4 ui-monospace,Consolas,monospace;white-space:pre-wrap;word-break:break-word}</style>
</head><body><pre>${esc(text)}</pre></body></html>`);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(e.status === 404 ? 404 : 500).send(e.status === 404 ? 'não encontrado' : 'erro');
  }
};
