# Caderno-m-sical-
Cardeno músical

## Bar · Caixa e Portaria (aplicativo)

Aplicativo que junta os projetos **Caixa bar** e **Portaria do Bar** em um só, com uma aba
para cada. Fica na pasta [`app/`](app/). É um PWA: pode ser instalado na tela inicial do
celular e funciona sem internet.

- `app/caixa.html`: o Caixa bar original, sem nenhuma alteração.
- `app/portaria.html`: a Portaria do Bar original. A única mudança é uma linha que carrega
  `claude-local.js`.
- `app/claude-local.js`: substitui o banco de dados do Claude (`claude.use("db")`) por um banco
  local, para a Portaria funcionar fora do claude.ai. Dentro do claude.ai ele não faz nada.
- `app/index.html`: a tela que junta os dois, com as abas Caixa e Portaria.

**Atenção:** no aplicativo, os dados ficam salvos só no aparelho e não sincronizam com a
equipe. Para sincronizar ao vivo, use os links dos artefatos no claude.ai.

### Publicação

O site é publicado a partir do branch `gh-pages` em
https://golesecocopocheio-eng.github.io/Caderno-m-sical-/
Para atualizar, copie o conteúdo de `app/` para a raiz do branch `gh-pages`.

### Rodar no computador

```bash
cd app
python3 -m http.server 8080
```
