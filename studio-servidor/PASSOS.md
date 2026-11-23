# Ligar a transcrição de letra no Clan music (pelo celular)

Custo: o plano gratuito do Cloudflare Workers atende 100.000 pedidos por dia e o Groq cobra US$ 0,04 por hora de áudio transcrito (confira os valores atuais no site deles). Uma música de 4 minutos custa menos de 1 centavo de dólar.

1. Crie uma conta gratuita em console.groq.com e gere uma chave em "API Keys". Copie a chave.
2. Crie uma conta gratuita em dash.cloudflare.com. Vá em Workers e Pages, Create, Hello World, Deploy.
3. Abra o Worker criado, toque em "Edit code", apague tudo, cole o conteúdo do arquivo `worker.js` e toque em Deploy.
4. Em Settings do Worker, Variables and Secrets, adicione: `GROQ_KEY` (a chave do passo 1, tipo Secret) e `APP_TOKEN` (uma senha que você inventar, tipo Secret).
5. Copie o endereço do Worker (termina em workers.dev).
6. No Clan music: Mixer, Transcrever letra, cole o endereço e a senha, e toque em Testar.
