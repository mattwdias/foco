// ===== CONFIGURAÇÃO — é só este arquivo que você edita =====
window.CONFIG = {
  titulo: "Foco",
  subtitulo: "Só o que importa. Sem rolagem infinita.",
  porCanal: 15,         // quantos vídeos mostrar de cada canal
  buscaPorCanal: 100,   // quantos guardar de cada canal para a busca e as raias (⌘K)
  cacheHoras: 3,        // reaproveita a lista por X horas (deixa o site rápido)

  // Música de fundo (player discreto no canto inferior direito)
  // Para trocar a música: cole o ID do vídeo (o que vem depois de "watch?v=")
  // Para desativar: apague o bloco "musica" inteiro.
  musica: {
    videoId: "iqr3khMncqM",
    titulo: "Idea 25",
    artista: "Gibran Alcocer & Andrea Vanzo",
    volume: 40          // 0 a 100
  },

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
