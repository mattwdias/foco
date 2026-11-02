// Busca os feeds do YouTube e grava data.json. Roda na GitHub Action, não na sua máquina.
import { readFile, writeFile } from 'node:fs/promises';

const src = await readFile(new URL('../config.js', import.meta.url), 'utf8');
const shim = {};
new Function('window', src)(shim);
const C = shim.CONFIG;

const canais = C.categorias.flatMap(c => c.canais);
const limite = Math.max(C.porCanal ?? 5, 15);   // guarda folga: o site corta depois

const unescape = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const tag = (xml, name) => {
  const m = xml.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>'));
  return m ? unescape(m[1].trim()) : '';
};

function parseFeed(xml) {
  const canal = tag(xml.split('<entry>')[0], 'name');
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: tag(e, 'yt:videoId'),
    title: tag(e, 'title'),
    channel: tag(e, 'name') || canal,
    published: tag(e, 'published')
  })).filter(v => v.id);
}

async function feed(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'foco-feed' } });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return parseFeed(await r.text());
}

const out = {};
let erros = 0;

for (const ch of canais) {
  try {
    // UULF + ID sem "UC" = playlist só de vídeos longos, sem Shorts
    let v = await feed('https://www.youtube.com/feeds/videos.xml?playlist_id=UULF' + ch.id.slice(2));
    if (!v.length) v = await feed('https://www.youtube.com/feeds/videos.xml?channel_id=' + ch.id);
    v.sort((a, b) => new Date(b.published) - new Date(a.published));
    out[ch.id] = v.slice(0, limite).map(x => ({ ...x, channel: x.channel || ch.nome }));
    console.log(`ok   ${ch.nome}: ${out[ch.id].length} vídeos`);
  } catch (e) {
    erros++;
    console.log(`FALHA ${ch.nome}: ${e.message}`);
  }
}

if (!Object.keys(out).length) { console.log('nenhum canal carregou — não vou sobrescrever o data.json'); process.exit(1); }

// preserva o que já havia para canais que falharam nesta rodada
try {
  const antigo = JSON.parse(await readFile(new URL('../data.json', import.meta.url), 'utf8'));
  for (const [id, v] of Object.entries(antigo.canais ?? {})) if (!out[id]) out[id] = v;
} catch {}

await writeFile(new URL('../data.json', import.meta.url),
  JSON.stringify({ gerado: new Date().toISOString(), canais: out }, null, 1) + '\n');
console.log(`data.json escrito — ${Object.keys(out).length} canais, ${erros} falha(s)`);
