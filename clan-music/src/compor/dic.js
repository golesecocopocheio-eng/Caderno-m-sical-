// Vocabulário próprio do Clan Music Studio (escrito para o app, sem lista de terceiros). Serve para rimas e versos offline.
// Substantivos: "o" masculino, "a" feminino. A letra de cada projeto do usuário também entra nas rimas.
const L = (s) => s.split(/[\s,]+/).filter(Boolean);
export const SM = L(`amor mar sol vento céu caminho tempo mundo coração sonho canto abraço silêncio olhar lugar destino desejo momento segredo sorriso perdão chão pão irmão verão refrão violão trovão portão medo dedo rio fogo jogo povo verso espelho lamento tormento pensamento sentimento juramento sofrimento movimento pé café sertão sal mal quintal sinal carnaval horizonte monte norte sul vinho inverno amanhã rosto peito beijo laço passo compasso ritmo som tom dom lar par luar altar pomar jardim fim começo fundo abismo ouro tesouro vizinho espinho carinho ninho menino sino hino cantor calor sabor valor favor senhor rumor farol anzol lençol futuro escuro muro enredo brinquedo rochedo paraíso improviso aviso riso dia violeiro fim cheiro mistério`);
export const SF = L(`saudade vida luz estrada paz chuva lua noite madrugada alegria esperança liberdade verdade cidade felicidade canção razão paixão ilusão emoção solidão multidão mão melodia poesia harmonia maresia dor cor flor mulher cruz voz vez raiz história memória glória vitória trajetória janela estrela favela ladeira beleza tristeza certeza natureza firmeza riqueza pobreza correnteza despedida partida chegada ferida saída prece fé maré nação oração intenção direção criação lição prisão visão tradição geração batida dança lembrança confiança mudança criança balança herança vingança distância infância brisa camisa fantasia agonia sintonia calmaria travessia companhia magia rebeldia sinfonia folia areia ideia aldeia sereia plateia rua resistência semente corrente tempestade humanidade juventude escuridão`);
export const INF = L(`amar cantar sonhar chorar voltar ficar caminhar viver crescer esquecer entender correr vencer sorrir partir seguir sentir existir dançar voar esperar lutar abraçar encontrar lembrar mudar pensar buscar rezar olhar deixar levar chegar passar gritar brilhar navegar recomeçar perdoar aprender perder ganhar resistir insistir persistir subir cair dormir acordar ouvir dizer fazer querer poder saber ver vir cantarolar vagar girar curar salvar provar tocar soltar cuidar tentar mostrar falar jogar pular acreditar libertar respirar`);
export const ADJ = L(`feliz livre forte triste grande simples leve azul fiel cruel igual capaz veloz audaz comum singular imortal real total normal quente doce verde breve`);
// Palavras só para rimar (formas conjugadas e palavras soltas comuns)
export const EXTRA = L(`lá cá aqui ali então assim sim mim comigo contigo consigo amigo perigo abrigo castigo inimigo vou sou estou dou foi vai sai cai trai mais jamais demais sempre gente frente mente presente ausente semente quente diferente somente contente paciente doente pra eu meu seu deu chapéu véu troféu mel papel anel pincel cantava sonhava esperava amava voava chorava dançava olhava lembrava buscava chamava ficava queria sabia dizia vivia sentia partia sorria fazia podia tinha vinha vem tem também ninguém além bem refém quero espero tenho venho vejo sinto canto sonho caminho vivo lembro choro volto fico parto sigo danço voo busco peço gosto fogo cedo medo tarde arde covarde vaidade saudade bondade maldade maturidade eternidade realidade intensidade claridade sinceridade quando cantando sonhando andando chorando voltando ficando amando vivendo sentindo sorrindo caindo seguindo partindo fugindo vendo lendo perdendo vencendo`);

// Temas: palavras preferidas ao sugerir versos
export const TEMAS = {
  amor: { nome: 'Amor', p: L('amor coração abraço beijo sorriso paixão desejo carinho felicidade amar sonhar abraçar sentir feliz doce') },
  saudade: { nome: 'Saudade', p: L('saudade distância lembrança partida chegada memória silêncio solidão noite chuva voltar lembrar esquecer chorar triste') },
  estrada: { nome: 'Estrada e viagem', p: L('caminho estrada horizonte vento destino rio mar chão passo travessia partir seguir caminhar navegar voar livre') },
  natureza: { nome: 'Natureza', p: L('sol lua mar rio chuva céu vento flor estrela maresia areia brisa luz brilhar verde azul') },
  luta: { nome: 'Luta e resistência', p: L('povo liberdade verdade esperança favela revolução nação voz razão vitória resistência lutar vencer resistir libertar forte livre') },
  festa: { nome: 'Festa e dança', p: L('dança batida carnaval canção alegria folia ritmo som violão refrão cantar dançar pular feliz') },
  fe: { nome: 'Fé e esperança', p: L('fé esperança oração prece luz paz amanhã vida vitória rezar acreditar esperar leve') },
};

// Modelos de verso. {w} é a palavra final; o artigo e a contração concordam com o gênero.
export const MOD = {
  n: [
    (a) => `Eu só quero ${a.o}`, (a) => `Vivo pensando ${a.em}`, (a) => `Meu peito fala ${a.de}`, (a) => `Não me peça pra esquecer ${a.o}`,
    (a) => `Tudo que eu tenho é ${a.o}`, (a) => `Cada dia eu canto ${a.o}`, (a) => `Eu levo comigo ${a.o}`, (a) => `Mesmo longe eu sinto ${a.o}`,
    (a) => `Só o tempo sabe ${a.de}`, (a) => `Sigo a vida sem perder ${a.o}`, (a) => `Quem vive de verdade guarda ${a.o}`, (a) => `Hoje eu acordei sonhando ${a.com}`,
  ],
  v: [
    (w) => `Eu nasci pra ${w}`, (w) => `Não vou deixar de ${w}`, (w) => `Tenho tanta força pra ${w}`, (w) => `Vim aqui só pra ${w}`,
    (w) => `Hoje eu acordei querendo ${w}`, (w) => `Nem o vento vai me impedir de ${w}`, (w) => `Todo mundo aprende a ${w}`, (w) => `Vale a pena tentar ${w}`,
  ],
  a: [
    (w) => `Meu coração ficou ${w}`, (w) => `Eu quero ver você ${w}`, (w) => `O que a gente sente é ${w}`, (w) => `Hoje o dia amanheceu ${w}`, (w) => `Se for pra ser, que seja ${w}`,
  ],
  x: [ // palavras só de rima: modelos neutros
    (w) => `E o que importa é ${w}`, (w) => `Eu repito, e canto ${w}`,
  ],
};
// Versos de abertura por tema (imagens). Terminam em palavras que o app também sabe rimar.
export const IMAGENS = {
  amor: ['Teu olhar me chamou pra dançar', 'Guardei teu nome no meu violão', 'Chegou sem avisar e ficou no meu lugar', 'Tem um verso teu em cada canção'],
  saudade: ['A noite chegou e você não voltou', 'Ainda ouço teus passos no chão', 'A chuva bateu na janela da solidão', 'Sobrou um silêncio no meu quintal'],
  estrada: ['Pego a estrada sem hora pra chegar', 'O vento me leva pro rumo que eu quis', 'Cada curva me ensina a caminhar', 'O sol vai na frente, abrindo o chão'],
  natureza: ['O sol nasceu no meu quintal', 'A lua clareia o caminho do mar', 'O rio me ensina a seguir', 'A brisa trouxe teu cheiro até mim'],
  luta: ['Levanta a cabeça, o povo vai vencer', 'Quem planta verdade colhe liberdade', 'A voz do povo ecoa pela nação', 'A favela canta e não vai se calar'],
  festa: ['Bate o tambor e a rua vai dançar', 'Tem violão e alegria no ar', 'Chegou a hora de cantar o refrão', 'A noite é nossa, vamos celebrar'],
  fe: ['Eu confio que amanhã vai clarear', 'Uma prece no peito me faz caminhar', 'Depois da chuva a luz vai voltar', 'A fé me leva por onde eu for'],
};
