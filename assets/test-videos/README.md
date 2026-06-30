# Vídeo de Teste — Pink Cut

Arquivos prontos pra uso:

- **`pinkcut-test-ptbr.mp4`** — vídeo 480×270, H.264 + AAC, **72.7s**, PT-BR (voz `Luciana`/macOS)
- **`pinkcut-test-ptbr.wav`** — mesmo áudio solto, 16 kHz mono PCM

## O que tem dentro

| Cenário                | Onde (mm:ss) | O que procurar                                       |
|------------------------|--------------|------------------------------------------------------|
| Filter words           | 0:04 – 0:19, 0:37 – 0:46, 0:57 – 0:58, 1:08 | "éh", "tipo", "né", "hum", "assim", "tá" |
| Double take (retake)   | 0:19 – 0:27  | mesma frase dita 2× (segmentos 05 e 06)             |
| Versão corrigida       | 0:28 – 0:31  | "Depois disso, basta…" (segmento 07)                  |
| Silêncio longo         | 0:50 – 0:52  | pausa de **2.0 s** entre segmentos 11 e 12            |
| Silêncios curtos       | entre todas as falas | pausas de 0.3 a 0.8 s                          |

Para a timeline exata (início/fim de cada utterance, palavras esperadas, IDs por
segmento), consulte [`manifest.txt`](./manifest.txt).

## Como usar no app

1. Abrir o Pink Cut
2. Importar `pinkcut-test-ptbr.mp4`
3. Rodar a transcrição local (parakeet-tdt-0.6b-v3-int8)
4. Validar:

   - **Filter Words** → conferir se as 6 filler words foram grifadas na transcrição
   - **Silence Cuts** → conferir se aparece o 𝄾 quarter rest entre as linhas
   - **Double Takes** → conferir se o par `(05, 06)` é detectado como retake
     e que só uma das duas sobrevive na edição

## Regenerar o vídeo

```bash
./scripts/generate.sh
```

Requisitos:

- macOS (comando `say` com voz PT-BR — `say -v "?" | grep pt_BR`)
- `ffmpeg` no PATH

O script é determinístico: regerar produz o mesmo áudio (a voz TTS é a mesma).
