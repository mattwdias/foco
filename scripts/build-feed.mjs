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
const guardarShorts = C.shorts?.guardar ?? 60;

// Opcional: com um secret YOUTUBE_API_KEY o job pega até `guardar` vídeos de uma vez.
// Sem ele, só o RSS (15 por canal) e o arquivo cresce aos poucos.
const APIKEY = process.env.YOUTUBE_API_KEY || '';

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

// O YouTube devolve 404 e 500 intermitentes para requisição de IP de datacenter — o Actions
// é um deles —, e o mesmo URL responde normalmente de um navegador. Então uma falha não
// significa canal inexistente: tenta de novo com espera crescente antes de desistir.
async function feed(url, tentativas = 3) {
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    if (i) await new Promise(r => setTimeout(r, 1500 * 2 ** (i - 1)));
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'foco-feed' } });
      if (r.ok) return parseFeed(await r.text());
      ultimo = new Error(url + ' -> ' + r.status);
    } catch (e) { ultimo = e; }
  }
  throw ultimo;
}

const RSS = 'https://www.youtube.com/feeds/videos.xml?';
const playlist = (pre, ch) => RSS + 'playlist_id=' + pre + ch.id.slice(2);

// Shorts pelo mesmo RSS que já funciona, sem chave de API e sem raspagem.
// Primeiro tenta a playlist de shorts (UUSH). Se ela não existir, sai por eliminação:
// o que está no feed do canal e NÃO está na playlist de vídeo longo (UULF) nem na de
// live (UULV) é short. O feed do canal traz os uploads mais recentes misturados, e um
// vídeo longo entre os 15 mais recentes está necessariamente na UULF, então a sobra é short.
async function shortsDoCanal(ch) {
  if (APIKEY) {
    const v = await viaApi(ch, 'UUSH', guardarShorts).catch(() => null);
    if (v?.length) return { via: 'api UUSH', videos: v };
  }
  // uma tentativa só: canal sem shorts não tem essa playlist, e a eliminação cobre o caso
  const direto = await feed(playlist('UUSH', ch), 1).catch(() => null);
  if (direto?.length) return { via: 'UUSH', videos: direto };

  // Sem a UULF não há como eliminar: deixar o erro subir é melhor do que marcar
  // vídeo longo como short e sujar o baralho.
  const todos = await feed(RSS + 'channel_id=' + ch.id);
  const longos = await feed(playlist('UULF', ch));
  const lives = await feed(playlist('UULV', ch)).catch(() => []);
  const fora = new Set([...longos, ...lives].map(v => v.id));
  return { via: 'eliminação', videos: todos.filter(v => !fora.has(v.id)) };
}

// playlistItems da playlist pedida (UULF = longos, UUSH = shorts): 50 por página, 1 unidade de quota cada
async function viaApi(ch, prefixo = 'UULF', limite = guardar) {
  const saida = [];
  let token = '';
  while (saida.length < limite) {
    const u = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    u.searchParams.set('part', 'snippet');
    u.searchParams.set('playlistId', prefixo + ch.id.slice(2));
    u.searchParams.set('maxResults', String(Math.min(50, limite - saida.length)));
    u.searchParams.set('key', APIKEY);
    if (token) u.searchParams.set('pageToken', token);

    const r = await fetch(u);
    if (!r.ok) throw new Error('API ' + r.status + ' ' + (await r.text()).slice(0, 120));
    const j = await r.json();
    for (const it of j.items ?? []) {
      const sn = it.snippet;
      if (sn?.resourceId?.videoId && sn.title !== 'Private video' && sn.title !== 'Deleted video')
        saida.push({
          id: sn.resourceId.videoId,
          title: sn.title,
          channel: sn.videoOwnerChannelTitle || ch.nome,
          published: sn.publishedAt
        });
    }
    token = j.nextPageToken || '';
    if (!token) break;
  }
  return saida;
}

const recente = (a, b) => new Date(b.published) - new Date(a.published);
const out = {}, outShorts = {};
let novos = 0, erros = 0, novosShorts = 0;

// Mescla acumulada: o RSS só entrega os mais recentes, então o arquivo cresce a cada rodada.
function mescla(arquivados, chegaram, ch, limite) {
  const mapa = new Map(arquivados.map(x => [x.id, x]));
  const antes = mapa.size;
  for (const x of chegaram) mapa.set(x.id, { ...x, channel: x.channel || ch.nome });
  return { lista: [...mapa.values()].sort(recente).slice(0, limite), novos: Math.max(0, mapa.size - antes) };
}

for (const ch of canais) {
  const arquivados = antigo?.canais?.[ch.id] ?? [];
  try {
    // UULF + ID sem "UC" = playlist só de vídeos longos, sem Shorts
    let v = APIKEY
      ? await viaApi(ch).catch(e => { console.log(`  api indisponível (${e.message}) — usando RSS`); return []; })
      : [];
    if (!v.length) {
      // a UULF pode dar 404 em canal sem vídeo longo: cair no feed do canal, como o index.html faz
      v = await feed(playlist('UULF', ch)).catch(() => []);
      if (!v.length) v = await feed(RSS + 'channel_id=' + ch.id);
    }

    const r = mescla(arquivados, v, ch, guardar);
    out[ch.id] = r.lista;
    novos += r.novos;
    console.log(`ok    ${ch.nome}: ${r.lista.length} no arquivo (+${r.novos})`);
  } catch (e) {
    erros++;
    if (arquivados.length) out[ch.id] = arquivados;   // melhor velho do que nada
    console.log(`FALHA ${ch.nome}: ${e.message}`);
  }

  // Shorts: falha aqui não derruba o canal, só deixa o baralho do dia como estava
  const shortsAntigos = antigo?.shorts?.[ch.id] ?? [];
  try {
    const { via, videos } = await shortsDoCanal(ch);
    const r = mescla(shortsAntigos, videos, ch, guardarShorts);
    if (r.lista.length) outShorts[ch.id] = r.lista;
    novosShorts += r.novos;
    console.log(`  shorts ${ch.nome}: ${r.lista.length} no arquivo (+${r.novos}) via ${via}`);
  } catch (e) {
    if (shortsAntigos.length) outShorts[ch.id] = shortsAntigos;
    console.log(`  shorts ${ch.nome}: FALHA ${e.message}`);
  }
}

if (!Object.keys(out).length) { console.log('nenhum canal carregou — data.json intocado'); process.exit(1); }

// Falhar alto: antes, com todos os canais falhando, o arquivo velho era preservado, nada
// mudava e a rodada terminava verde. O site servia lista parada e ninguém ficava sabendo.
if (erros === canais.length) {
  console.log(`nenhum canal respondeu (${erros} falha(s)) — arquivo preservado, mas isto é falha`);
  process.exit(1);
}

// canais que saíram do config.js deixam de ser guardados; os que falharam já foram preservados acima
if (antigo && JSON.stringify(antigo.canais) === JSON.stringify(out)
          && JSON.stringify(antigo.shorts ?? {}) === JSON.stringify(outShorts)) {
  console.log('nada mudou — data.json intocado');
  process.exit(0);
}

await writeFile(ARQ, JSON.stringify({ gerado: new Date().toISOString(), canais: out, shorts: outShorts }, null, 1) + '\n');
const total = Object.values(out).reduce((n, v) => n + v.length, 0);
const totalShorts = Object.values(outShorts).reduce((n, v) => n + v.length, 0);
console.log(`data.json escrito — ${Object.keys(out).length} canais, ${total} vídeos, ${novos} novo(s), ${erros} falha(s)`);
console.log(`                   ${totalShorts} shorts em ${Object.keys(outShorts).length} canal(is), ${novosShorts} novo(s)`);
