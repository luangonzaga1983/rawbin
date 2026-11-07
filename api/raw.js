const { discord, channel } = require('./_discord');

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const unwrap = (c) => c.replace(/^```\n?/, '').replace(/\n?```$/, '');

module.exports = async (req, res) => {
  try {
    const id = String(req.query.id || '');
    if (!/^\d{15,25}$/.test(id)) return res.status(404).send('não encontrado');

    const idx = await discord(`/channels/${channel()}/messages/${id}`);
    let text;

    if (idx.content === 'RAW-FILE' && idx.attachments && idx.attachments.length) {
      // formato novo: arquivo anexado (a mensagem devolve a URL assinada atual)
      const f = await fetch(idx.attachments[0].url);
      if (!f.ok) throw new Error('falha ao baixar anexo');
      text = await f.text();
    } else if (idx.content.startsWith('RAW-INDEX ')) {
      // formato antigo: vários pedaços em mensagens
      const ids = JSON.parse(idx.content.slice(10)).c;
      const map = {};
      const min = ids.reduce((a, b) => (BigInt(a) < BigInt(b) ? a : b));
      const bulk = await discord(
        `/channels/${channel()}/messages?after=${BigInt(min) - 1n}&limit=100`
      );
      for (const m of bulk) map[m.id] = m.content;
      for (const cid of ids) {
        if (map[cid] === undefined) {
          const m = await discord(`/channels/${channel()}/messages/${cid}`);
          map[cid] = m.content;
        }
      }
      text = ids.map((cid) => unwrap(map[cid])).join('');
    } else {
      return res.status(404).send('não encontrado');
    }

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
