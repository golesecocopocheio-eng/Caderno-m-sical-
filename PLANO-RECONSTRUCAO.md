# CLAN MUSIC — plano de reconstrução (rascunho para aprovação)

Branch: `clan-music-rebuild`. O app antigo continua intacto na branch `claude/caderno-musical-apk` e na tag `backup-clan-music-apk35`. A `main` não é alterada.

## Regras
- Só tecnologia gratuita e de código aberto. Sem API paga, sem cartão.
- Android primeiro. PWA instalável + APK (Capacitor).
- Tudo que for possível roda offline no aparelho. Modelos de IA baixam uma vez (precisa de internet nessa hora) e depois funcionam sem.
- Projetos salvos no celular (IndexedDB/OPFS). Nunca apagar nada sem pedir.

## Estrutura de arquivos proposta
```
clan-music/
  index.html
  manifest.webmanifest
  sw.js                      # offline (cache do app e dos modelos)
  src/
    main.js                  # inicia o app e a navegação
    ui/                      # telas e componentes (tema próprio)
      tema.css               # identidade: ouro, preto e roxo
      inicio.js  gravar.js  compor.js  banda.js  arranjo.js
      estudio.js  separar.js  mixagem.js  biblioteca.js
    audio/
      motor.js               # contexto de áudio, reprodução, relógio
      gravador.js            # microfone, WAV, cantarolar
      efeitos.js             # EQ, compressor, reverb, delay
      exportar.js            # WAV, MP3, ZIP de faixas
    analise/
      bpm.js  tom.js  acordes.js  notas.js   # análise no aparelho
    ia/
      adaptador.js           # interface única para qualquer IA local
      letras.js              # sugestões de letra e rimas
      banda.js               # Minha Banda IA
      separacao.js           # separação de instrumentos
      modelos/               # modelos baixados (gerenciador e cache)
    musica/
      teoria.js  estilos.js  arranjador.js  midi.js
    dados/
      banco.js               # IndexedDB, projetos, versões
      migrar-antigo.js       # importa o app antigo sem apagar nada
    vendor/                  # bibliotecas de terceiros (licença conferida)
  android/                   # Capacitor (APK)
  testes/
  docs/
```

## Tecnologias candidatas (a conferir licença e tamanho antes de usar)
| Função | Opção gratuita | Observação |
|---|---|---|
| Gravação | MediaRecorder + AudioWorklet, WAV | já dominado |
| BPM, tom, acordes | análise própria (já feita e testada no app atual) | evita bibliotecas com licença restritiva |
| Notas (melodia) | pitch próprio (já feito) e Basic Pitch (TF.js, Apache-2.0) para notas de vários instrumentos | modelo pequeno, roda offline |
| Letra por voz | Vosk (WASM, Apache-2.0) ou Whisper pequeno (transformers.js) | modelo de dezenas de MB; erra mais com música ao fundo |
| Sugestão de letras e rimas | dicionário de rimas offline + modelo de linguagem pequeno no aparelho (opcional) | qualidade em português é limitada nos modelos pequenos |
| Minha Banda IA | geração de MIDI por regras e estilos + SoundFont livre (timbres reais de baixo, bateria, guitarra, violão e teclado) | bem melhor que o som sintetizado atual; sem custo |
| Arranjador | regras por estilo (reggae, rock, pop, samba...) sobre os acordes e a estrutura | opcional: Magenta (Apache-2.0) |
| Separação de instrumentos | Spleeter/Open-Unmix/Demucs em ONNX ou TF.js | lento no celular e modelos grandes; começar por voz + acompanhamento |
| Mixagem e exportação | OfflineAudioContext, WAV; MP3 e ZIP com bibliotecas livres | |
| Armazenamento | IndexedDB e OPFS | |
| Empacotamento | Vite (build no GitHub Actions) + Capacitor | |

## Etapas (cada uma testada antes da próxima)
1. Base: projeto, tema, navegação, banco de projetos, PWA offline, APK pelo GitHub Actions.
2. Importar tudo do app antigo (cópia, sem apagar) e Biblioteca.
3. Gravação de voz e cantarolar, com forma de onda e salvamento automático.
4. Análise: notas, acordes e BPM.
5. Estúdio multipistas e Mixagem/Exportação.
6. Minha Banda IA e Arranjador (MIDI + SoundFont).
7. Compositor e letras (rimas, sugestões, versões da letra, nunca trocar a original sozinho).
8. Separação de instrumentos.
9. Acabamento, testes no Android e publicação.

## Limites honestos
- IA no celular, grátis, é menos capaz que serviços pagos. Letras e separação de faixas vão ser úteis, não perfeitas.
- Modelos grandes ocupam espaço e demoram em celulares fracos.
- Gerar música completa com voz cantada (como serviços pagos) não é viável de graça no aparelho.
- A arquitetura de adaptadores deixa um ponto único para trocar por IA melhor no futuro.
