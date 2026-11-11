// ===== CONFIGURAÇÃO — é só este arquivo que você edita =====
window.CONFIG = {
  titulo: "Foco",
  subtitulo: "Só o que importa. Sem rolagem infinita.",
  porCanal: 15,         // quantos vídeos mostrar de cada canal
  buscaPorCanal: 100,   // quantos guardar de cada canal para a busca e as raias (⌘K)
                        // Só chega a 100 com o secret YOUTUBE_API_KEY no repo;
                        // sem ele o RSS traz 15 por rodada e o arquivo enche aos poucos.
  cacheHoras: 3,        // reaproveita a lista por X horas (deixa o site rápido)

  // Aba Shorts: baralho FINITO, dos mesmos canais acima.
  // O site não tem rolagem infinita; aqui o tempo é o formato, não o freio.
  // Para desativar a aba: apague o bloco "shorts" inteiro.
  shorts: {
    minutos: 5,        // orçamento por sessão, contando só tempo de reprodução
    esperaHoras: 1,    // depois de zerar, espera tanto antes de liberar de novo
    baralho: 200,      // quantos shorts entram na sessão — o teto real é o tempo, não a contagem
    guardar: 300       // quantos shorts o job guarda por canal no data.json
  },

  // Música de fundo (player discreto no canto inferior direito)
  // Para trocar a música: cole o ID do vídeo (o que vem depois de "watch?v=")
  // Para desativar: apague o bloco "musica" inteiro.
  musica: {
    videoId: "iqr3khMncqM",
    titulo: "Idea 25",
    artista: "Gibran Alcocer & Andrea Vanzo",
    volume: 40          // 0 a 100
  },

  // Vídeos que já entram nos favoritos na primeira visita.
  // Se você remover depois, não voltam.
  favoritosIniciais: [
    {
      id: "QkXfWALFQ68",
      title: "Learn English in 10 Hours - ALL YOU NEED TO SPEAK ENGLISH FLUENTLY",
      channel: "JForrest English",
      published: "2025-03-21T12:00:42Z",
      cat: "Inglês"
    }
  ],

  categorias: [
    {
      nome: "Vida",
      canais: [
        { nome: "Rafael Gratta", id: "UCiKhN0fi01tPKjK5tweGL2Q" },   // youtube.com/@rafaelgratta
        { nome: "Bagetti",       id: "UChE9LYDtlxXnE3JXMDKhymQ" },   // youtube.com/@henriquebagetti
        { nome: "Pinho",         id: "UC7Xog4-zhRQKbahvs27I7Ow" }    // youtube.com/@Pinhotube
      ]
    },
    {
      nome: "Música",
      canais: [
        { nome: "Gibran Alcocer", id: "UC_6zyKjvT-qt1Uf-_yqHb4Q" }   // pianista
      ]
    },
    {
      nome: "Inglês",
      canais: [
        { nome: "JForrest English", id: "UCLNBasuHKOILIwewAetJO6g" }   // youtube.com/@JForrestEnglish
      ]
    },
    {
      nome: "Viagens",
      canais: [
        { nome: "Chicco Mattos",      id: "UCysb54tfQHGIK9jB2VI8_HQ" },   // youtube.com/@chiccomattos
        { nome: "Sven's One Bag Life", id: "UCNZ9lcLo5VEDtnVHuB9dMhg" }   // youtube.com/@SvensOneBagLife
      ]
    }
    // Para criar outra categoria, copie o bloco acima:
    // { nome: "Aprender", canais: [ { nome: "Fulano", id: "UCxxxxxxxxxxxxxxxxxxxxxx" } ] }
  ]
};
