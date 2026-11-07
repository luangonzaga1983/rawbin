const { discord, channel } = require('./_discord');

const MAX_BYTES = 4 * 1024 * 1024; // limite da Vercel (4.5MB) ~ milhares de linhas

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'método inválido' });
  try {
    const { content, password } = req.body || {};
    if (process.env.ADMIN_PASSWORD && password !== process.env.ADMIN_PASSWORD)
      return res.status(401).json({ error: 'senha incorreta' });
    if (typeof content !== 'string' || !content.length)
      return res.status(400).json({ error: 'conteúdo vazio' });
    if (Buffer.byteLength(content, 'utf8') > MAX_BYTES)
      return res.status(413).json({ error: 'grande demais (máx 4MB)' });

    // salva o texto como arquivo .txt anexado numa única mensagem
    const fd = new FormData();
    fd.append(
      'payload_json',
      JSON.stringify({ content: 'RAW-FILE', allowed_mentions: { parse: [] } })
    );
    fd.append('files[0]', new Blob([content], { type: 'text/plain' }), 'raw.txt');

    const m = await discord(`/channels/${channel()}/messages`, { method: 'POST', body: fd });
    res.status(200).json({ id: m.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'falha ao salvar no Discord' });
  }
};
