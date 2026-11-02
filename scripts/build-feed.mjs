// Busca os feeds do YouTube e mantém o data.json. Roda na GitHub Action, não na sua máquina.
// O RSS do YouTube só entrega os 15 vídeos mais recentes de cada canal, então o arquivo
// é acumulado: cada rodada mescla o que chegou com o que já havia, até buscaPorCanal.
import { readFile, writeFile } from 'node:fs/promises';

const ARQ = new URL('../data.json', import.meta.url);
const src = await readFile(new URL('../config.js', import.meta.url), 'utf8');
const shim = {};
new Function('window', src)(shim);
const C = shim.CONFIG;

const canais = C.categorias.flatMap(c => c.canais);
const guardar = C.buscaPorCanal ?? 50;

let antigo = null;
try { antigo = JSON.parse(await readFile(ARQ, 'utf8')); } catch {}

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

const recente = (a, b) => new Date(b.published) - new Date(a.published);
const out = {};
let novos = 0, erros = 0;

for (const ch of canais) {
  const arquivados = antigo?.canais?.[ch.id] ?? [];
  try {
    // UULF + ID sem "UC" = playlist só de vídeos longos, sem Shorts
    let v = await feed('https://www.youtube.com/feeds/videos.xml?playlist_id=UULF' + ch.id.slice(2));
    if (!v.length) v = await feed('https://www.youtube.com/feeds/videos.xml?channel_id=' + ch.id);

    const mapa = new Map(arquivados.map(x => [x.id, x]));
    const antes = mapa.size;
    for (const x of v) mapa.set(x.id, { ...x, channel: x.channel || ch.nome });
    out[ch.id] = [...mapa.values()].sort(recente).slice(0, guardar);
    novos += Math.max(0, mapa.size - antes);
    console.log(`ok    ${ch.nome}: ${out[ch.id].length} no arquivo (+${Math.max(0, mapa.size - antes)})`);
  } catch (e) {
    erros++;
    if (arquivados.length) out[ch.id] = arquivados;   // melhor velho do que nada
    console.log(`FALHA ${ch.nome}: ${e.message}`);
  }
}

if (!Object.keys(out).length) { console.log('nenhum canal carregou — data.json intocado'); process.exit(1); }

// canais que saíram do config.js deixam de ser guardados; os que falharam já foram preservados acima
if (antigo && JSON.stringify(antigo.canais) === JSON.stringify(out)) {
  console.log('nada mudou — data.json intocado');
  process.exit(0);
}

await writeFile(ARQ, JSON.stringify({ gerado: new Date().toISOString(), canais: out }, null, 1) + '\n');
const total = Object.values(out).reduce((n, v) => n + v.length, 0);
console.log(`data.json escrito — ${Object.keys(out).length} canais, ${total} vídeos, ${novos} novo(s), ${erros} falha(s)`);
