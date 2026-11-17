# Caderno-m-sical-
Cardeno músical

## Clã Speak · tradutor ao vivo (`app/tradutor.html`)

Aplicativo de tradução de voz em tempo real. Você fala no seu idioma e a outra pessoa lê
(e ouve) no idioma dela, enquanto você ainda está falando. Pode ser instalado na tela inicial
como app próprio ("Clã Speak", ícone do gatinho preto "MIAU!"). Arquivos: `app/tradutor.html`, `app/tradutor.js`,
`app/tradutor.webmanifest`, `app/icons/clan-speak-*.png`.

- **Sala remota:** cada pessoa usa o próprio celular, de qualquer lugar. Crie uma sala (código de
  6 letras) e toque em **Convidar** para mandar o link ou mostrar o QR Code. Cada um escolhe o seu
  idioma; as falas aparecem traduzidas para cada participante, com o original embaixo, e a fala
  "ao vivo" (antes de terminar a frase) também aparece traduzida. 🔊 liga/desliga a leitura em voz.
- **Frente a frente:** um celular só, na mesa entre duas pessoas. A tela se divide (a parte de cima
  fica de cabeça para baixo); cada lado tem seu idioma e seu microfone.
- Dá para digitar em vez de falar.
- 24 idiomas (português, inglês, espanhol, francês, italiano, alemão, japonês, chinês, árabe…).

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

### Dados do bar

Nenhum dado do bar fica neste repositório (ele é público). Os dados ficam no aparelho e, com a
sincronização ligada, no Firebase. Um celular novo puxa tudo da nuvem ao entrar com o código do bar.

### Publicação

O site é publicado a partir do branch `gh-pages` em
https://golesecocopocheio-eng.github.io/Caderno-m-sical-/
Para atualizar, copie o conteúdo de `app/` para a raiz do branch `gh-pages`.

### Rodar no computador

```bash
cd app
python3 -m http.server 8080
```
