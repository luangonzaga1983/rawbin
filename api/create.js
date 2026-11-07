const { discord, channel } = require('./_discord');

const CHUNK = 1900;      // limite do Discord é 2000 (sobra espaço pro ``` )
const MAX_CHUNKS = 45;   // ~85 mil caracteres por raw

function split(text) {
  const parts = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + CHUNK, text.length);
    // não corta emoji no meio
    const c = text.charCodeAt(end - 1);
    if (end < text.length && c >= 0xd800 && c <= 0xdbff) end--;
    parts.push(text.slice(i, end));
    i = end;
  }
  return parts;
}

const send = (content) =>
  discord(`/channels/${channel()}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'método inválido' });
  try {
    const { content, password } = req.body || {};
    if (process.env.ADMIN_PASSWORD && password !== process.env.ADMIN_PASSWORD)
      return res.status(401).json({ error: 'senha incorreta' });
    if (typeof content !== 'string' || !content.length)
      return res.status(400).json({ error: 'conteúdo vazio' });

    const parts = split(content);
    if (parts.length > MAX_CHUNKS)
      return res.status(413).json({ error: `grande demais (máx ~${CHUNK * MAX_CHUNKS} caracteres)` });

    // envia os pedaços (5 por vez; a ordem fica guardada no índice)
    const ids = new Array(parts.length);
    for (let i = 0; i < parts.length; i += 5) {
      await Promise.all(
        parts.slice(i, i + 5).map(async (p, k) => {
          // ``` preserva espaços/linhas em branco no começo e fim
          const m = await send('```\n' + p + '\n```');
          ids[i + k] = m.id;
        })
      );
    }

    // mensagem-índice: o ID dela é o ID do link
    const index = await send('RAW-INDEX ' + JSON.stringify({ v: 1, c: ids }));
    res.status(200).json({ id: index.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'falha ao salvar no Discord' });
  }
};
