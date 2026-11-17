# Caderno-m-sical-
Cardeno músical

## Clã Speak · Tradutor ao Vivo (`app/tradutor.html`)

Aplicativo de tradução de voz em tempo real. Você fala no seu idioma e a outra pessoa lê
(e ouve) no idioma dela, enquanto você ainda está falando. Pode ser instalado na tela inicial
como app próprio ("Clã Speak"). Arquivos: `app/tradutor.html`, `app/tradutor.js`,
`app/tradutor.webmanifest`, `app/icons/tradutor-*.png`.

- **Sala remota:** cada pessoa usa o próprio celular, de qualquer lugar. Crie uma sala (código de
  6 letras) e toque em **Convidar** para mandar o link ou mostrar o QR Code. Cada um escolhe o seu
  idioma; as falas aparecem traduzidas para cada participante, com o original embaixo, e a fala
  "ao vivo" (antes de terminar a frase) também aparece traduzida. 🔊 liga/desliga a leitura em voz.
- **Frente a frente:** um celular só, na mesa entre duas pessoas. A tela se divide (a parte de cima
  fica de cabeça para baixo); cada lado tem seu idioma e seu microfone.
- Dá para digitar em vez de falar.
- **Visual corporativo (2026-11):** design minimalista no estilo Linear/Stripe/Vercel. Fundo neutro
  `#0A0A0B`, cartões `#111113` com borda de 1px, destaque índigo `#5E6AD2`, tipografia Inter/sistema e ícones
  de linha em SVG (`app/tradutor-ui.js` troca os emojis da interface por ícones; o conteúdo — mensagens,
  reações, textos traduzidos — fica como está). O mascote gatinho saiu de todas as telas: os balões dele
  viraram linhas de status discretas e as animações decorativas (confete, palco, notinhas) foram desligadas.
  Logo: lua crescente amarela (que também forma o "C" de Clã) com ondas de voz, num círculo roxo-escuro com estrelas e borda dourada; nome "Clã" em branco e "Speak" em amarelo. Cores do app: roxo `#7C3AED` e amarelo `#FACC15` (`app/icons/claspeak.svg`). Capa com logo, nome e frase na tela de abertura do app e do APK; capas para divulgar em `app/icons/capa/` (vertical 1080×1920 e horizontal 1200×630).
- **Fundo de céu com galáxias (tema claro):** o app usa um céu noturno em roxo, lilás, rosa e azul-claro (véu escuro sobre o céu pastel) (lilás, rosa, azul e
  dourado) com estrelas e galáxias espirais (`app/icons/ceu.webp`, gerada pelo próprio projeto). Cartões
  brancos translúcidos com desfoque, texto escuro e destaques em roxo e amarelo; a tela de abertura e o splash
  do APK seguem o mesmo céu.
- **Capa minimalista (by Sanka Brunelli):** abertura do app, splash do APK e capas de divulgação com degradê liso
  roxo → magenta → rosa, a lua grande no centro, o nome "Clã Speak" em branco, a frase e a assinatura
  "by Sanka Brunelli".
- **Abas evoluídas:** barra de baixo maior (ícones de 22 px, aba ativa com fundo e traço em degradê); sala com
  código em destaque, botões grandes (fone, voz, Convidar, Sair), emojis maiores e microfone de 56 px; frente a
  frente com botões grandes de ícone + nome (Voz, Fone, Auto, Limpar, Sair) e caixas de texto maiores.
- **Frente a frente transparente:** as caixas da escrita são transparentes (aparecem o céu, planetas e estrelas), com borda lilás e texto branco com sombra; seletores de idioma translúcidos.
- **Frente a frente com cosmos:** a faixa do meio (botões Voz, Fone, Auto, Limpar, Sair) tem céu roxo com planeta
  rosa de anel dourado, planeta azul, planetinhas lilás e dourado, estrelas piscando e estrelas cadentes.
- **Paleta:** roxo, lilás, rosa e azul-claro, com um toque de dourado (cabeçalhos das abas, planetas, estrelas,
  cometas e o nome "Speak" em degradê).
- **Planetas e estrelas em todo o app:** no fundo de todas as abas há 6 planetas flutuando devagar (dois com
  anel), 80 estrelas que brilham e dois cometas passando; na aba Ajustes, o cabeçalho tem planeta de anel e lua em órbita. Todas as caixas de
  marcar do app viraram interruptores modernos (liga/desliga).
- **Motor de tradução:**
  - **Padrão (gratuito):** Google Tradutor sem chave, com MyMemory de reserva.
  - **Modo Executivo (opcional):** em ⚙️ Ajustes → Motor de tradução, escolha "Executivo", cole a sua chave
    da API da Anthropic, o **setor** (Jurídico, Médico, Financeiro, TI, Engenharia, Comercial, Marketing,
    Acadêmico, Governo…) e o **registro** (Formal, Técnico, Neutro). As traduções finais passam a ser feitas
    pelo Claude como um Tradutor Executivo Sênior: terminologia do setor, registro formal/técnico e somente a
    tradução, sem comentários. "Testar" faz uma tradução de exemplo. A chave fica guardada só no aparelho e é
    enviada só para a API da Anthropic (SDK oficial em `app/vendor/anthropic-sdk.js`). As prévias "ao vivo" e
    as listas continuam no Google (mais rápido); se a API falhar, o app volta sozinho para o Google.
- **Aba ☁️ Backup** (`app/tradutor-backup.js`): os dados do app (favoritos,
  histórico, pontos, artigos salvos, letras do Karaokê e ajustes) são salvos sozinhos no Firestore
  (`copias/{código}`): a cada minuto se algo mudou, ao sair do app e ao abrir os Ajustes. Cada aparelho tem um
  **código de backup** de 12 letras; com ele, "Restaurar backup" recupera tudo em outro celular. "Baixar backup"
  gera o arquivo `claspeak-backup-AAAA-MM-DD.json` (no APK abre o compartilhar: Drive, e-mail, WhatsApp), que
  também pode ser restaurado. A chave da API e o cache de traduções nunca entram no backup. **Precisa publicar de
  novo o `firestore.rules`** (ganhou a regra `copias`).
- **Aba Estudar** (`app/tradutor-estudo.js`): frases por tema (Saudações, Conversa, Viagem, Restaurante,
  Compras, Números, Emergência, Trabalho) traduzidas na hora, com ouvir, devagar, repetir (o app confere a
  pronúncia) e quiz. Pontos e dias seguidos ficam guardados no aparelho.
- **7 abas:** Traduzir (sala, frente a frente e texto), Saber, Estudar, Karaokê, Conversar, Backup e Ajustes.
- **Texto:** traduz enquanto digita, ditado pelo microfone, inverter idiomas, ouvir, copiar, favoritas e recentes.
- **Ajustes:** motor de tradução, segurar para falar, modo fone, velocidade da voz, ler em voz alta, sons de
  interface, letras grandes e apagar as traduções guardadas.
- **Áudio da sala:** escolhe a voz mais natural do aparelho para cada idioma, destaca a mensagem que está
  sendo lida, bipe ao ligar/desligar o microfone e repetir a última.
- **Modo fone de ouvido:** com fone, o microfone continua ouvindo enquanto a tradução toca.
- **Aba Saber** (`app/tradutor-saber.js`): pergunte (escrevendo ou falando) e o app busca na **Wikipédia**
  (API pública, CC BY-SA) o artigo mais relevante, com resumo, imagem, "veja também", ouvir, ler em outro
  idioma, leitura guiada frase por frase, vocabulário traduzido, teste "complete a frase", artigos salvos e
  "Hoje na história". Temas: Literatura, Artes, História, Ciência, Geografia, Música, Filosofia e Esportes.
- **Aba Conversar** (`app/tradutor-conversa.js`): prática de conversação em tela de bate-papo (Cafeteria,
  Aeroporto, Hotel, Compras, Fazer amigos, Entrevista), com sugestões de resposta, nota de 0 a 3 por fala e resumo.
- **Aba Karaokê** (`app/tradutor-musica.js`): link do YouTube (player oficial incorporado, nada é baixado) +
  letra colada, traduzida verso por verso, com marcação de tempo, cantar junto com nota, velocidade e repetição A-B.
- **Frente a frente Automático:** com Auto ligado, o app passa a vez sozinho entre os dois lados.
- **Sala:** bandeiras dos idiomas, som de mensagem nova, copiar, avatares, aviso de quem entrou e saiu,
  emojis e reações nas mensagens e "fulano está falando...".
- 24 idiomas (português, inglês, espanhol, francês, italiano, alemão, japonês, chinês, árabe…).
- **APK Android próprio ("Clã Speak", logo redondo da lua amarela em roxo-escuro):** o workflow `.github/workflows/apk-tradutor.yml` gera o
  `ClaSpeak.apk` (pasta `android-tradutor/`) e publica na página **Releases** do GitHub, com a etiqueta
  `tradutor-apk-N`. No APK, a voz usa os plugins nativos do Android (reconhecimento do Google e leitura
  em voz alta), e o convite para a sala é pelo código.

Como funciona: o reconhecimento de voz e a leitura em voz alta são do próprio navegador (Chrome no
Android, Safari no iPhone; precisa de internet). A tradução usa o Google Tradutor gratuito, sem chave
(com reservas). A sala usa o mesmo Firebase do app do bar (`app/firebase-config.js`), na coleção
`salas`. **Antes de usar a sala entre celulares, publique de novo o `firestore.rules`** no Console do
Firebase (Firestore Database → Regras → Publicar): ele ganhou a regra das salas. Sem o Firebase, a
sala funciona só entre abas do mesmo aparelho; o modo frente a frente não precisa dele.

## Bar Conect · Caixa, Portaria e Estoque (aplicativo)

Logo: taça de coquetel dourada com palito e azeitona, ondas de conexão e o nome BAR CONECT ·
CAIXA · PORTARIA · ESTOQUE, em roxo-escuro e dourado (`app/icons/`, `android-build/assets/`).

Aplicativo que junta os projetos **Caixa bar**, **Portaria do Bar** e **Estoque do Bar** em um só, com uma aba
para cada. Fica na pasta [`app/`](app/). É um PWA: pode ser instalado na tela inicial do
celular e funciona sem internet.

- `app/caixa.html`: o Caixa bar original. A única mudança é uma linha que carrega
  `claude-local.js`, para usar a sincronização.
- `app/portaria.html`: a Portaria do Bar original, com uma linha que carrega `claude-local.js`
  e o bloco **♻️ Backup** no fim da tela (acima do QR Code): copiar o backup da portaria e **restaurar qualquer backup** (do Caixa,
  da Portaria, do Estoque ou o `dados-do-bar.json`), gravando cada parte na aba certa.
  Também aceita o **resumo da noite em texto** ("Portaria do Bar · noite de …"): recria a noite com
  os mesmos totais e substitui o que já existia nela.
  Sem o acréscimo de R$ 5 depois da meia-noite: o preço é sempre o de "Valores da portaria".
- `app/estoque.html`: o Estoque do Bar original, com a mesma linha que carrega `claude-local.js`
  e o bloco **Backup do estoque** (copiar e restaurar backup; aceita também o `dados-do-bar.json`).
- `app/claude-local.js`: substitui o banco de dados do Claude (`claude.use("db")` e
  `claude.use("user")`) pelo Firebase, ou por um banco local quando o Firebase não está
  configurado. Dentro do claude.ai ele não faz nada.
- `app/porta.html`: página só com a Portaria, aberta pelo **QR Code para a equipe** ou pelo botão
  **Compartilhar link** da Portaria. Funciona no iPhone e no Android e pode ser instalada como app
  próprio ("Portaria"). Com a sincronização ligada, o link leva o código do bar.
- `app/index.html`: a tela que junta os três, com as abas Caixa, Portaria, Estoque, **Backup** e Ajustes.
  A aba **💾 Backup** copia (ou baixa) o backup completo de Caixa, Portaria e Estoque num texto só,
  e restaura qualquer backup do app, o `dados-do-bar.json` ou o resumo da noite da Portaria.

### Sincronização entre celulares (Firebase)

Com o Firebase configurado, Caixa, Portaria e Estoque sincronizam entre todos os celulares
que entrarem com o mesmo **código do bar**. Quem cria o código primeiro vira o **dono**: só o
dono vê as opções que, nos projetos originais, eram do dono ou do editor. Sem o Firebase, os
dados ficam salvos só no aparelho.

- `app/firebase-config.js`: configuração do projeto Firebase (`null` = sem sincronização).
- `app/vendor/`: bibliotecas do Firebase (v10, compat), guardadas no site para funcionar offline.
- `firestore.rules`: regras de segurança do banco.

**Como configurar (uma vez):**

1. Em https://console.firebase.google.com, crie um projeto. O Google Analytics não é necessário.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
3. **Build → Firestore Database → Create database.** Escolha a região `southamerica-east1`
   (São Paulo) e o modo de produção.
4. Na aba **Regras** do Firestore, cole o conteúdo de `firestore.rules` e clique em **Publicar**.
5. Em **Configurações do projeto (⚙️) → Seus apps → Web (</>)**, registre um app e copie o
   objeto `firebaseConfig`.
6. Cole esse objeto em `app/firebase-config.js`, no lugar do `null`.

### Ficha técnica

Na Ficha técnica (Caixa → Ficha técnica) dá para **criar**, **editar** e **apagar** fichas: nome do drink,
ingredientes (um por linha, com a quantidade na frente: `40 ml Gin`, `½ limão taiti`, `2 dash Angostura bitter`)
e modo de preparo. Cada receita mostra o custo total e o custo de cada ingrediente. As fichas ficam em
`meta.fichas` do Caixa (entram no backup e na sincronização); as 12 originais continuam como padrão.

### Ferramentas (aba ⚙️ Ajustes)

- **Abas:** mostrar, esconder e mudar a ordem das abas da barra de baixo.
- **Cores do app:** Roxo (padrão), Azul-noite, Verde-garrafa, Vinho ou Grafite.
- **Apresentação de abertura:** ligar/desligar e velocidade (rápida, normal, longa).
- **Fichas técnicas:** atalho e "voltar às fichas originais".
- **Editor avançado:** ver e corrigir qualquer dado (fechamentos de um mês, configurações do Caixa,
  Portaria, Estoque). Antes de salvar, faz um backup automático (os últimos 3), que pode ser restaurado.
- **Manutenção:** recarregar, limpar a cópia offline e ver o espaço usado.

### Tabela de preços (aba 💲 Preços) e foto da nota de compra

Tire foto da nota de compra (ou use o botão **📷 Foto da nota** na Ficha técnica). O app lê cada produto
(quantidade, unidade UN/KG/CX..., preço unitário, total e tamanho: 750 ml, 1 kg, 12×350 ml) e sugere a
ligação com o **ingrediente da Ficha técnica** e com o **item do Estoque**, lembrando a escolha para as
próximas notas. Ao aplicar:

- atualiza o custo das receitas (`meta.custo` do Caixa): bebidas pelo preço da garrafa e ml; itens
  comprados por kg e usados por unidade (limão) pelo rendimento (unidades por kg e ml de suco por kg);
  itens usados em dash/gota pelo número de doses da garrafa (≈1 ml cada);
- calcula o **valor da garrafa** (total pago ÷ quantidade) e o **valor da dose** pelos ml da garrafa
  (dose padrão de 50 ml e garrafa padrão de 750 ml quando os ml não aparecem, ambos ajustáveis em
  Ficha técnica → Preços dos ingredientes); ingredientes sem
  quantidade nas receitas (ex.: "Jack Daniels") contam como 1 dose;
- soma a compra no Estoque (movimento de compra, preço e registro da compra);
- guarda o produto na tabela de preços (`meta.tabPrecos`), com preço por litro/kg, data, nota,
  quantidade e valor em estoque.

### Fechamento por foto (aba 📸 Foto)

Tire foto dos comprovantes de fechamento das maquininhas (ou escolha da galeria). O app lê os valores
**sem internet** (Tesseract, em `app/vendor/ocr`) e separa **Crédito + Débito = Cartão** e
**Pix + QR Code = Pix**; quando o comprovante tem linhas por bandeira e um resumo, usa o resumo para não
contar duas vezes, e compara com o total lido na foto. O dinheiro é digitado à mão (calculadora: valores
separados por + ou um por linha). O app soma todas as fotos da operação, monta o relatório e, com
confirmação, preenche o fechamento do dia no Caixa (Bar: dinheiro, cartão, pix; ou Portaria), sem mexer
nos outros campos do dia. Todos os valores lidos podem ser corrigidos antes de aplicar.

### Histórico de alterações

Toda gravação no Caixa, na Portaria e no Estoque (criar, mudar ou apagar) fica registrada com data,
hora e quem fez. Na aba **💾 Backup → 🕘 Histórico** dá para ver a lista e tocar em **Voltar** para
devolver um item ao que era naquele momento (só o dono). Sem o Firebase, o histórico fica no
aparelho (últimas alterações); com o Firebase, fica na nuvem (`bares/{codigo}/historico`), vale
para todos os celulares e as regras não deixam editar nem apagar registros.

### Dados iniciais do APK

`android-build/dados-iniciais.json` vai **só dentro do APK** (não vai para o site). Na primeira abertura
de cada versão desse pacote, o app **preenche o que falta** no aparelho, sem substituir nada que já foi
lançado: no Caixa, dias que faltam e campos vazios; na Portaria, noites sem nenhuma entrada; no
Estoque, itens e registros que faltam. Atenção: este repositório é público, então esse arquivo também é.

### Publicação

O site é publicado a partir do branch `gh-pages` em
https://golesecocopocheio-eng.github.io/Caderno-m-sical-/
Para atualizar, copie o conteúdo de `app/` para a raiz do branch `gh-pages`.

### Rodar no computador

```bash
cd app
python3 -m http.server 8080
```
