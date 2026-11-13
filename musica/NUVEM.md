# Nuvem do Clan music (Firebase) — passo a passo

Leva uns 10 minutos, é feito uma vez só, no navegador (celular ou computador).

## 1. Criar o projeto
1. Entre em https://console.firebase.google.com com a sua conta Google.
2. **Criar projeto** → nome "clan-music" → pode desligar o Google Analytics → **Criar**.

## 2. Ligar o login anônimo
1. Menu **Criação > Authentication** → **Vamos começar**.
2. Aba **Método de login** → **Anônimo** → ative → **Salvar**.

## 3. Ligar o banco de dados (letras e cifras — grátis)
1. Menu **Criação > Firestore Database** → **Criar banco de dados**.
2. Local: **southamerica-east1 (São Paulo)** → modo **produção** → **Criar**.
3. Aba **Regras**, apague tudo, cole o texto abaixo e toque em **Publicar**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /musicas/{codigo}/songs/{musica} {
      allow read, write: if request.auth != null;
    }
  }
}
```

(Quem não souber o código de 16 caracteres da sua conta não consegue achar suas músicas, porque não existe lista pública.)

## 4. Áudios na nuvem (opcional)
O Firebase pode pedir para ativar um plano com cota grátis e cadastrar cartão para usar o **Storage**. Se não quiser, pule: letras e cifras sincronizam do mesmo jeito e os áudios ficam em cada aparelho.
1. Menu **Criação > Storage** → **Vamos começar** → mesmo local → **Concluir**.
2. Aba **Regras**, cole e **Publicar**:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /musicas/{codigo}/{arquivo} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.resource.size < 60 * 1024 * 1024;
    }
  }
}
```

## 5. Pegar a configuração
1. Engrenagem ⚙ **Configurações do projeto** → **Geral** → role até **Seus apps** → ícone **</>** (Web) → apelido "clan-music" → **Registrar app**.
2. Copie o bloco `const firebaseConfig = { ... }` inteiro.

## 6. Colocar no app
No Clan music (Chrome e APK): ícone de **nuvem** → cole o bloco → **Guardar configuração** → **Criar um código novo**.
No outro aparelho: ícone de nuvem → cole o mesmo bloco → **Entrar com este código** e digite o código do primeiro.

Para sincronizar também os áudios, marque a opção na tela da Nuvem (só se ligou o Storage).
