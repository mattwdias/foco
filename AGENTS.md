# Foco — guia do repositório

Site pessoal que mostra só os vídeos mais recentes de uma lista curada de canais do
YouTube, em categorias, para fugir de recomendação e rolagem infinita.

- **No ar:** https://mattwdias.github.io/foco/
- **Hospedagem:** GitHub Pages, servido do branch `main`, raiz do repo (build legada, com Jekyll)
- **Sem build, sem dependências, sem framework.** O site é um HTML único; o job usa só Node puro.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | O site inteiro: markup, CSS e JS num só arquivo |
| `config.js` | **O único arquivo pensado para edição manual.** Define `window.CONFIG` |
| `data.json` | **Gerado pelo job. Nunca editar à mão.** Arquivo de vídeos por canal |
| `scripts/build-feed.mjs` | Busca os feeds e mantém o `data.json` |
| `.github/workflows/feed.yml` | Roda o script e commita o `data.json` quando muda |

## config.js

| Campo | Papel |
|---|---|
| `titulo`, `subtitulo` | Cabeçalho da página |
| `porCanal` | Quantos vídeos **aparecem** de cada canal (hoje 15) |
| `buscaPorCanal` | Quantos ficam **guardados** por canal, para a busca (hoje 100) |
| `cacheHoras` | TTL do cache de emergência no navegador, usado só se o `data.json` faltar |
| `shorts` | Aba Shorts: `minutos` de orçamento, `esperaHoras` de bloqueio, `baralho` (quantos por sessão) e `guardar` (quantos o job arquiva por canal). Apagar o bloco remove a aba |
| `musica` | Player discreto no canto. Apagar o bloco desliga |
| `favoritosIniciais` | Vídeos que entram nos favoritos na primeira visita |
| `categorias` | Lista de categorias, cada uma com seus canais |

### Categorias hoje

| Categoria | Canais |
|---|---|
| Vida | Rafael Gratta, Bagetti, Pinho |
| Música | Gibran Alcocer |
| Inglês | JForrest English |
| Viagens | Chicco Mattos, Sven's One Bag Life |

A aba **★ Favoritos** vem depois dessas e **não** fica no config: é gerada pelo
`index.html` e alimentada pelo navegador de quem acessa.

### Adicionar um canal

O config quer o ID `UC…`, não o @handle. Para descobrir:

```sh
curl -sL -A 'Mozilla/5.0' https://www.youtube.com/@HANDLE \
  | grep -oE 'rel="canonical" href="[^"]+' | head -1
```

Depois: inserir em `categorias`, rodar `node scripts/build-feed.mjs`, commitar
`config.js` **e** `data.json`, dar push e **disparar o job na mão** (ver limitação abaixo).

## data.json

```json
{ "gerado": "<ISO>",
  "canais": { "<UC…>": [ { "id", "title", "channel", "published" } ] },
  "shorts": { "<UC…>": [ { "id", "title", "channel", "published" } ] } }
```

Regras do gerador, que importam para não quebrar nada:

- **É acumulado.** Cada rodada mescla o que chegou com o que já estava, dedupe por `id`,
  ordena do mais novo para o mais velho e corta em `buscaPorCanal`. Por isso o arquivo
  cresce além dos 15 que o RSS entrega.
- **Canal que falha preserva o que tinha.** Se nenhum canal carregar, o arquivo não é tocado.
- **Só reescreve quando a lista muda.** O campo `gerado` mudaria a cada rodada e geraria
  commit de 3 em 3 horas, então a comparação ignora ele e olha só `canais`.
- **Canal retirado do config deixa de ser guardado** na próxima rodada.

## Como os Shorts chegam, sem chave de API

O RSS não informa duração, então o short sai **por eliminação**, com os mesmos feeds que já
funcionam. `shortsDoCanal()` tenta, nesta ordem:

1. **`playlist_id=UUSH…`** — a playlist de shorts do canal. Quando existe, resolve direto.
2. **Eliminação:** `channel_id=…` menos `playlist_id=UULF…` menos `playlist_id=UULV…`.
   O feed do canal traz os uploads mais recentes misturados; um vídeo longo que está entre os
   mais recentes está necessariamente na UULF, e live está na UULV. **A sobra é short.**
3. **API**, só se o secret `YOUTUBE_API_KEY` existir: `playlistItems` da UUSH, páginas de 50.

O log diz qual caminho venceu (`via UUSH`, `via eliminação`, `via api UUSH`).

**Se a UULF falhar, o passo 2 aborta de propósito** e o canal fica com os shorts que já tinha.
Marcar vídeo longo como short sujaria o baralho, e short errado é pior do que short nenhum.
É exatamente por isso que a UULF excluir Shorts "de graça" deixou de ser só economia: é o
discriminador. Se o YouTube mudar esse comportamento, a eliminação para de valer.

## O limite dos 15 e a chave de API

O RSS do YouTube (`feeds/videos.xml?playlist_id=UULF…`) devolve **no máximo 15 vídeos por
canal**. É limite da fonte, não do código. O `UULF` + ID sem o `UC` é a playlist de uploads
longos, o que já exclui Shorts de graça.

Para ir além existe o caminho oficial, opcional: se o secret `YOUTUBE_API_KEY` existir, o
script usa a YouTube Data API v3 (`playlistItems`, páginas de 50) e preenche até
`buscaPorCanal` de uma vez; sem o secret, cai no RSS automaticamente. Custo ~2 unidades por
canal por rodada, contra 10.000/dia de cota.

```sh
gh secret set YOUTUBE_API_KEY --repo mattwdias/foco
```

Decisão tomada de propósito: **não raspar o HTML do YouTube**. Seria frágil e fica em área
cinzenta dos termos de uso.

## O job

Gatilhos declarados: `schedule` (`7 */3 * * *`), `push` na `main` e `workflow_dispatch`.
Tem `permissions: contents: write`, que basta — o padrão do repo é `read`, mas o bloco do
workflow sobrepõe. Não há risco de laço: o commit do job sai com `GITHUB_TOKEN`, e push
feito com esse token não dispara workflow.

### Limitação conhecida: só o disparo manual funciona

Nos testes deste repo, **nem push nem cron criaram run**; apenas `workflow_dispatch`.
Verificado: workflow `active`, Actions `enabled` com `allowed_actions: all`, YAML válido
(o dispatch roda), e o GitHub registrando `config.js` como alterado na raiz. Tirar o filtro
`paths` não mudou nada, então não era o filtro. O `pages-build-deployment` que aparece a
cada push é evento `dynamic`, do serviço de Pages — não é workflow de push.

Causa não determinada. Então, por enquanto, **depois de mexer no config, dispare na mão**:

```sh
gh workflow run feed.yml --repo mattwdias/foco
```

Outra coisa já vista: a build legada do Pages às vezes falha com 500 do próprio GitHub
("is githubstatus.com reporting a Pages outage?"). A seguinte costuma passar.

## Como o index.html funciona

Três blocos de script, nesta ordem:

1. **No `<head>`:** aplica o tema salvo antes da primeira pintura, para não piscar.
2. **Player de música:** IIFE própria, YouTube IFrame API. Pausa ao abrir um vídeo e
   retoma ao fechar. Começa minimizado em tela estreita.
3. **O site:** IIFE principal.

Ordem de carga dos dados: tenta `data.json` do próprio domínio (mesma origem, sem CORS);
se faltar, cai numa fila de proxies públicos (`allorigins`, `codetabs`, `r.jina.ai`) com
cache de `cacheHoras` no navegador. **`corsproxy.io` foi removido: passou a exigir chave.**
Os proxies são rede de segurança, não o caminho normal.

### Estado no navegador (localStorage)

| Chave | Conteúdo |
|---|---|
| `watched` | IDs já abertos, últimos 500. Some da grade, não dos favoritos |
| `favoritos` | Favoritos, com **cópia** dos metadados, até 500 |
| `favSemeados` | IDs já semeados por `favoritosIniciais`, para remoção ser definitiva |
| `tema` | `light` ou `dark`. Ausente = segue o navegador |
| `visao` | `raias` quando agrupado por canal. Ausente = grade |
| `musica` | `on`, `off` ou `min` |
| `shortsSaldo` | Milissegundos de Shorts que ainda restam na sessão. Gravado a cada segundo |
| `shortsAte` | Timestamp em que o bloqueio de Shorts expira. `0` = liberado |
| `shortsBaralho` | IDs do baralho da sessão, para recarregar a página não reembaralhar |
| `shortsVistos` | Shorts já tocados, últimos 300, para o baralho não repetir |

Favoritos guardam cópia do vídeo de propósito: assim o favorito sobrevive quando o vídeo
sai do arquivo de `buscaPorCanal`.

### Interface

- **Busca** (lupa, `⌘K` ou `/`): varre o arquivo inteiro, não só o que está na tela.
  Normaliza acento e caixa e usa um radical simples de português, então "jejum" acha
  "Jejuar". Peso: título > canal/categoria > só radical.
- **Raias** (botão de linhas): troca a grade por raias horizontais estilo pool de BPMN,
  canal na etiqueta à esquerda, em ordem alfabética. Não é o padrão; fica salvo.
- **Tema** (`◐`): auto → claro → escuro.
- **Favoritos:** estrela no card e botão no player.
- **Shorts** (última aba): baralho **finito** de `baralho` shorts, embaralhado e intercalado
  por canal, em pista vertical com encaixe. **Um player por vez:** o `IntersectionObserver`
  diz quem está encaixado, e o `YT.Player` é criado ali e destruído ao sair — é o que permite
  contar tempo pelos eventos de reprodução em vez de tempo de parede. O cronômetro é um fio de
  2px acima da pista; o relógio em mm:ss só aparece no último minuto. Zerado, grava
  `shortsAte` e a aba fecha até a espera passar.

## Convenções

- Código, comentários e mensagens de commit **em português**.
- **Nada de dependência nova.** Sem npm, sem bundler, sem framework. Node puro no job.
- `config.js` é a fonte única da curadoria; o gerador lê os canais dele, não duplica lista.
- Mexer em `index.html` com edição cirúrgica; é um arquivo só, e o CSS depende de ordem.

### Decisões a não desfazer sem pedido

- **Clique no fundo preto não fecha o player.** Foi pedido explícito: só o botão Fechar
  e o Esc. Não reintroduza `close()` no clique do backdrop do `#modal`.
- **O `data.json` não é editado à mão.**
- **Sem raspagem do YouTube.**
- **O baralho de Shorts é finito.** O site promete "sem rolagem infinita" e isso vale para a
  aba Shorts: o tempo é o formato, não um freio que corta no meio. Não transformar a pista em
  carregamento contínuo, e não tirar o limite de tempo para "deixar escolher na hora".
- **O cronômetro conta reprodução, não tempo de parede**, e o saldo é persistido. Trocar por
  `setInterval` solto devolveria tempo a cada recarga e puniria quem sai da aba.

## Verificação antes de publicar

Não existe suíte de testes. O mínimo:

```sh
node scripts/build-feed.mjs    # deve dizer "nada mudou" na segunda rodada seguida
```

E checar a sintaxe dos scripts embutidos, que é onde dá erro de verdade:

```sh
python3 -I - <<'PY'
import re, pathlib, subprocess, tempfile
s = pathlib.Path("index.html").read_text()
for i, b in enumerate(re.findall(r"<script>\n([\s\S]*?)</script>", s)):
    f = tempfile.NamedTemporaryFile("w", suffix=".js", delete=False); f.write(b); f.close()
    r = subprocess.run(["node", "--check", f.name], capture_output=True, text=True)
    print(i + 1, "ok" if r.returncode == 0 else r.stderr[:300])
PY
```

Depois do push, confirmar o que está servindo de verdade:

```sh
curl -s https://mattwdias.github.io/foco/data.json | head -c 200
```

## Segurança

Nunca commitar token ou chave. A chave da API entra como **secret do repo**, não no
`config.js` — que é servido publicamente, como todo arquivo deste repo.
