# Caderno-m-sical-
Cardeno músical

## Bar · Caixa, Portaria e Estoque (aplicativo)

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
