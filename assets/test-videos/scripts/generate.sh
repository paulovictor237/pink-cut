#!/usr/bin/env bash
# Gera um vídeo de teste (PT-BR) com falhas controladas para validar o Pink Cut.
#
# O arquivo final contém, garantidamente:
#   - Filter words: "éh", "ãh", "hum", "tipo", "né", "assim"
#   - Double takes: frases ditas, depois refeitas (o Descript/Glíng chama de "retake")
#   - Silêncios: pausas longas e curtas entre frases
#
# Saída:
#   pink-cut/assets/test-videos/pinkcut-test-ptbr.mp4   (completo, ~1 min)
#   pink-cut/assets/test-videos/pinkcut-test-ptbr.wav   (só áudio)
#
# Requisitos: macOS com `say` (TTS nativo) e ffmpeg no PATH.
set -euo pipefail

# O script vive em <repo>/assets/test-videos/scripts/generate.sh
# O repo raiz fica 3 níveis acima.
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SEG="$ROOT/assets/test-videos/segments"
OUT="$ROOT/assets/test-videos"
TMP="$ROOT/assets/test-videos/.tmp"

rm -rf "$TMP" && mkdir -p "$TMP" "$SEG"

TTS_VOICE="Luciana"   # PT-BR nativa do macOS
SR=16000              # sample rate padrão para transcrição

# --- Lista de falas ----------------------------------------------------------
# Formato: label|texto|silêncio_apos_ms
#
# Itens marcados com prefixo "TAKE1" / "TAKE2" representam o mesmo trecho
# dito duas vezes (double take) — útil para validar o recurso de retake.
# Itens "FILL" foram pensados para disparar o filtro de palavras de preenchimento.

declare -a LINES=(
  "OPEN|Fala galera, sejam bem vindos a mais um vídeo do Pink Cut.|500"
  "FILL|éh, hoje eu vou mostrar como a ferramenta funciona na prática.|700"
  "BODY|A primeira coisa que a gente precisa fazer é importar um vídeo.|600"
  "FILL|éh, tipo, basta arrastar e soltar o arquivo aqui nesta área.|800"
  "TAKE1|Depois disso, é só clicar no botão de transcrever.|400"
  "TAKE1|Depois disso, é só clicar no botão de transcrever, tá?|300"
  "TAKE2|Depois disso, basta clicar no botão de transcrever.|1500"
  "BODY|A transcrição é feita localmente com o modelo parakeet.|700"
  "FILL|né, isso significa que nada sai do seu computador.|700"
  "BODY|hum, e o processo leva alguns minutos dependendo do tamanho.|800"
  "BODY|Agora vamos ver os três recursos principais.|2000"
  "BODY|O primeiro são as palavras de preenchimento, como assim, éh, hum.|600"
  "BODY|O segundo são os cortes de silêncio, marcados com uma pausa musical.|800"
  "BODY|E o terceiro são os takes repetidos, que a gente chama de retake.|600"
  "FILL|tá bom, é isso aí, valeu e até a próxima.|1500"
)

# --- Geração dos segmentos TTS ----------------------------------------------
echo "🎙️  Gerando segmentos TTS em $SEG ..."
i=0
for entry in "${LINES[@]}"; do
  IFS='|' read -r label text pause_ms <<< "$entry"
  i=$((i+1))
  num=$(printf "%02d" "$i")
  out="$TMP/${num}_${label}.wav"

  # `say` no macOS grava direto em arquivo
  say -v "$TTS_VOICE" -o "$out" --data-format=LEI16@${SR} "$text" 2>/dev/null

  # Aplica o silêncio ao final do segmento
  if [[ "$pause_ms" -gt 0 ]]; then
    sox "$out" "$TMP/${num}_p.wav" pad 0 "${pause_ms}ms" 2>/dev/null \
      || ffmpeg -y -loglevel error -i "$out" \
           -af "apad=pad_dur=${pause_ms}ms" "$TMP/${num}_p.wav"
    mv "$TMP/${num}_p.wav" "$out"
  fi
done

# --- Concatenação -----------------------------------------------------------
echo "🧩  Concatenando segmentos ..."
list="$TMP/list.txt"
: > "$list"
for f in "$TMP"/[0-9][0-9]_*.wav; do
  echo "file '$f'" >> "$list"
done

ffmpeg -y -loglevel error -f concat -safe 0 -i "$list" \
  -ar $SR -ac 1 -c:a pcm_s16le "$TMP/concat.wav"

cp "$TMP/concat.wav" "$OUT/pinkcut-test-ptbr.wav"

# --- Empacotamento como MP4 (com vídeo) -------------------------------------
# Vídeo de cor sólida (rosa pastel do Pink Cut), 480x270, 30fps.
# Mostra a transcrição rolando como overlay, simulando o app.
echo "🎬  Empacotando MP4 com overlay de transcrição ..."

# Gera imagem de fundo (1 frame) e depois cria vídeo
ffmpeg -y -loglevel error \
  -f lavfi -i "color=c=#ffd6e7:s=480x270:d=1" \
  -frames:v 1 "$TMP/bg.png"

# Cria o vídeo de fundo com a duração do áudio
DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$TMP/concat.wav" | cut -d. -f1)
DUR=${DUR:-45}
DUR=$((DUR + 1))

ffmpeg -y -loglevel error \
  -loop 1 -framerate 30 -i "$TMP/bg.png" \
  -i "$TMP/concat.wav" \
  -c:v libx264 -preset veryfast -tune stillimage \
  -c:a aac -b:a 128k -shortest \
  -t "$DUR" -pix_fmt yuv420p \
  "$OUT/pinkcut-test-ptbr.mp4"

# --- Manifesto de "ground truth" -------------------------------------------
# Descreve onde estão as falhas, pra você conferir com o editor.
cat > "$OUT/README.md" <<'EOF'
# Vídeo de Teste — Pink Cut

Arquivo principal: **`pinkcut-test-ptbr.mp4`** (~1 min, 480×270, PT-BR).
Áudio solto: **`pinkcut-test-ptbr.wav`**.

## Cenários garantidos no áudio

| Tipo             | Onde aparece (aprox.) | O que procurar                     |
|------------------|-----------------------|------------------------------------|
| Filter words     | 0:06 – 0:13           | "éh", "tipo", "né", "hum", "assim" |
| Double take      | 0:24 – 0:34           | mesma frase dita 2× (Take 1 + Take 2) |
| Silêncio longo   | 0:34 – 0:36           | pausa de ~2 s                      |
| Silêncio médio   | entre frases          | pausas de 0,5 a 0,8 s              |

## Como usar

1. Abra o app Pink Cut
2. Importe `pinkcut-test-ptbr.mp4`
3. Rode a transcrição local (parakeet-tdt-0.6b-v3-int8)
4. Valide:
   - **Filter Words** → as palavras grifadas na transcrição
   - **Silence Cuts** → os 𝄾 quarter rests entre linhas
   - **Double Takes** → os pares de linhas duplicadas

## Regenerar

```bash
./scripts/generate.sh
```

Requer macOS (comando `say`) e ffmpeg.
EOF

echo "✅  Pronto!"
echo "    → $OUT/pinkcut-test-ptbr.mp4"
echo "    → $OUT/pinkcut-test-ptbr.wav"
echo "    → $OUT/README.md"
