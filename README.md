# Caderno-m-sical-
Cardeno músical

## Caixa & Portaria (aplicativo)

Aplicativo único que junta o **controle de caixa** e o **controle de portaria**.
Fica na pasta [`app/`](app/). É um PWA: funciona no navegador, pode ser
instalado na tela inicial do celular ou do computador e funciona sem internet.

### Funcionalidades

**Caixa**
- Abrir caixa com suprimento inicial (troco)
- Lançar entradas e saídas com forma de pagamento, categoria e descrição
- Estorno de lançamentos
- Fechar caixa com conferência do valor contado (sobra ou falta vira lançamento de ajuste)
- Resumo diário de entradas, saídas e resultado

**Portaria**
- Registrar entrada de visitantes, prestadores, entregadores, moradores e funcionários
- Lista de quem está no local agora, com busca e tempo de permanência
- Registrar saída
- Controle de encomendas (recebimento e retirada)
- Histórico por dia e preenchimento automático de visitantes já cadastrados

**Integração entre os dois**
- Na saída de um visitante com veículo, o app sugere cobrar o estacionamento
  (horas × valor por hora configurado). O valor entra direto no caixa.
- O painel mostra saldo, entradas e saídas do dia, visitas, pessoas no local e encomendas pendentes

**Outros**
- Relatório do dia, exportação em CSV (caixa e portaria), backup e restauração em JSON

### Como usar

Sirva a pasta `app/` com qualquer servidor estático. Exemplo:

```bash
cd app
python3 -m http.server 8080
```

Abra `http://localhost:8080` e use "Instalar aplicativo" ou "Adicionar à tela inicial".
Para usar no celular, publique a pasta `app/` (por exemplo, no GitHub Pages).

Os dados ficam salvos apenas no aparelho (localStorage). Faça backups pela aba **Mais**.
