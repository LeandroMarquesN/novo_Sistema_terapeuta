// assets/cid10-comum.js
// Lista curada de códigos CID-10 mais usados em clínica multi-especialidade.
// NÃO é a tabela oficial completa (essa tem 14.000+ códigos) — é um ponto de partida.
// O campo continua aceitando digitação livre para qualquer código fora desta lista.

const CID10_COMUM = [
  // ── Saúde mental (F) ──
  { codigo: 'F32.0', descricao: 'Episódio depressivo leve' },
  { codigo: 'F32.1', descricao: 'Episódio depressivo moderado' },
  { codigo: 'F32.2', descricao: 'Episódio depressivo grave sem sintomas psicóticos' },
  { codigo: 'F32.9', descricao: 'Episódio depressivo não especificado' },
  { codigo: 'F33.0', descricao: 'Transtorno depressivo recorrente, episódio leve' },
  { codigo: 'F33.1', descricao: 'Transtorno depressivo recorrente, episódio moderado' },
  { codigo: 'F40.0', descricao: 'Agorafobia' },
  { codigo: 'F40.1', descricao: 'Fobias sociais' },
  { codigo: 'F40.2', descricao: 'Fobias específicas (isoladas)' },
  { codigo: 'F41.0', descricao: 'Transtorno de pânico' },
  { codigo: 'F41.1', descricao: 'Transtorno de ansiedade generalizada' },
  { codigo: 'F41.2', descricao: 'Transtorno misto ansioso e depressivo' },
  { codigo: 'F41.9', descricao: 'Transtorno de ansiedade não especificado' },
  { codigo: 'F42.0', descricao: 'Predominância de ideias ou ruminações obsessivas' },
  { codigo: 'F42.9', descricao: 'Transtorno obsessivo-compulsivo não especificado' },
  { codigo: 'F43.0', descricao: 'Reação aguda ao estresse' },
  { codigo: 'F43.1', descricao: 'Transtorno de estresse pós-traumático' },
  { codigo: 'F43.2', descricao: 'Transtornos de adaptação' },
  { codigo: 'F45.0', descricao: 'Transtorno de somatização' },
  { codigo: 'F50.0', descricao: 'Anorexia nervosa' },
  { codigo: 'F50.2', descricao: 'Bulimia nervosa' },
  { codigo: 'F51.0', descricao: 'Insônia não orgânica' },
  { codigo: 'F60.3', descricao: 'Transtorno de personalidade emocionalmente instável' },
  { codigo: 'F70', descricao: 'Retardo mental leve' },
  { codigo: 'F80.0', descricao: 'Transtorno específico da articulação da fala' },
  { codigo: 'F80.1', descricao: 'Transtorno expressivo da linguagem' },
  { codigo: 'F80.2', descricao: 'Transtorno receptivo da linguagem' },
  { codigo: 'F81.0', descricao: 'Transtorno específico de leitura (dislexia)' },
  { codigo: 'F81.2', descricao: 'Transtorno específico da habilidade em aritmética' },
  { codigo: 'F84.0', descricao: 'Autismo infantil' },
  { codigo: 'F84.5', descricao: 'Síndrome de Asperger' },
  { codigo: 'F90.0', descricao: 'Distúrbios da atividade e da atenção (TDAH)' },
  { codigo: 'F91.9', descricao: 'Transtorno de conduta não especificado' },
  { codigo: 'F98.0', descricao: 'Enurese não orgânica' },

  // ── Neurologia ──
  { codigo: 'G40.9', descricao: 'Epilepsia não especificada' },
  { codigo: 'G43.0', descricao: 'Enxaqueca sem aura' },
  { codigo: 'G43.1', descricao: 'Enxaqueca com aura' },
  { codigo: 'G44.2', descricao: 'Cefaleia tipo tensional' },
  { codigo: 'G47.0', descricao: 'Distúrbios do início e da manutenção do sono' },
  { codigo: 'G47.1', descricao: 'Distúrbios de sonolência excessiva' },
  { codigo: 'G56.0', descricao: 'Síndrome do túnel do carpo' },

  // ── Musculoesquelético / Fisioterapia (M) ──
  { codigo: 'M25.5', descricao: 'Dor articular' },
  { codigo: 'M51.1', descricao: 'Transtornos de discos lombares com radiculopatia' },
  { codigo: 'M54.2', descricao: 'Cervicalgia' },
  { codigo: 'M54.4', descricao: 'Lumbago com ciática' },
  { codigo: 'M54.5', descricao: 'Dor lombar baixa' },
  { codigo: 'M62.8', descricao: 'Outros transtornos musculares especificados' },
  { codigo: 'M75.1', descricao: 'Síndrome do manguito rotador' },
  { codigo: 'M79.1', descricao: 'Mialgia' },
  { codigo: 'M79.7', descricao: 'Fibromialgia' },

  // ── Nutrição / Metabólico (E) ──
  { codigo: 'E66.0', descricao: 'Obesidade devida a excesso de calorias' },
  { codigo: 'E66.9', descricao: 'Obesidade não especificada' },
  { codigo: 'E63.9', descricao: 'Carência nutricional não especificada' },
  { codigo: 'E78.5', descricao: 'Dislipidemia não especificada' },
  { codigo: 'E86', descricao: 'Depleção de volume (desidratação)' },

  // ── Fonoaudiologia ──
  { codigo: 'R47.0', descricao: 'Disfasia e afasia' },
  { codigo: 'R48.2', descricao: 'Apraxia' },
  { codigo: 'H90.3', descricao: 'Perda de audição neurossensorial bilateral' },
  { codigo: 'H91.9', descricao: 'Perda de audição não especificada' },

  // ── Clínico geral / comuns ──
  { codigo: 'I10', descricao: 'Hipertensão essencial (primária)' },
  { codigo: 'E11.9', descricao: 'Diabetes mellitus tipo 2 sem complicações' },
  { codigo: 'J00', descricao: 'Nasofaringite aguda (resfriado comum)' },
  { codigo: 'J01.9', descricao: 'Sinusite aguda não especificada' },
  { codigo: 'J06.9', descricao: 'Infecção aguda das vias aéreas superiores' },
  { codigo: 'J45.9', descricao: 'Asma não especificada' },
  { codigo: 'K21.0', descricao: 'Doença de refluxo gastroesofágico com esofagite' },
  { codigo: 'K29.7', descricao: 'Gastrite não especificada' },
  { codigo: 'K59.0', descricao: 'Constipação' },
  { codigo: 'N39.0', descricao: 'Infecção do trato urinário' },
  { codigo: 'R10.4', descricao: 'Outras dores abdominais e as não especificadas' },
  { codigo: 'R51', descricao: 'Cefaleia' },
  { codigo: 'R63.4', descricao: 'Perda de peso anormal' },
  { codigo: 'Z00.0', descricao: 'Exame médico geral' }
];

if (typeof window !== 'undefined') window.CID10_COMUM = CID10_COMUM;
