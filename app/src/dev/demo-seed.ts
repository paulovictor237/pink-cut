/**
 * Dev-only sample seed — used to preview the transcript view (and any
 * future visual states) without running the full ASR pipeline.
 *
 * Activated ONLY when the URL contains `?demo=1`. Production traffic
 * never sees this branch because the `?demo` query is not part of any
 * normal user flow and the seeder is imported lazily from the dev
 * bootstrap.
 */
import { useEffect, useRef } from "react";
import type { ProjectAsset } from "@/lib/project-context";
import type { Transcription } from "@/features/transcription";
import { classifySilence } from "@/features/transcription/silence-policy";

export type DemoSeederHandle = {
  asset: ProjectAsset;
  transcription: Transcription;
};

export function useDemoSeed(
  enabled: boolean,
  onSeed: (handle: DemoSeederHandle) => void,
) {
  // The `onSeed` callback is recreated on every render, so we can't put it
  // in the effect's deps without re-running forever. Refs let us invoke
  // the latest closure while keeping the effect itself mount-once.
  const onSeedRef = useRef(onSeed);
  onSeedRef.current = onSeed;
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (firedRef.current) return;
    firedRef.current = true;
    onSeedRef.current(buildDemo());
  }, [enabled]);
}

function buildDemo(): DemoSeederHandle {
  const segments = SAMPLE_LINES.map((line, i) => {
    const startMs = i * 4000;
    const endMs = startMs + 3000;
    const words = line.split(" ").map((w, j) => ({
      text: w,
      startMs: startMs + j * 200,
      endMs: startMs + j * 200 + 180,
      confidence: j === 3 && i === 1 ? 0.62 : 0.95,
    }));
    return {
      id: `seg_${i}`,
      startMs,
      endMs,
      words,
    };
  });

  // Sprinkle a couple of silences so the 𝄾 glyph shows up too.
  const silences = [
    { startMs: 3800, endMs: 5200 }, // long pause (hard)
    { startMs: 7800, endMs: 8400 }, // short breath (soft)
  ].map((s) => ({ ...s, kind: classifySilence(s.endMs - s.startMs) }));

  const transcription: Transcription = {
    version: 1,
    language: "pt",
    durationMs: segments.length * 4000,
    segments,
    silences,
    createdAt: Date.now(),
  };

  const asset: ProjectAsset = {
    id: "demo_asset",
    file: {
      name: "demo-pink-cut.mp4",
      path: "/tmp/demo-pink-cut.mp4",
      size: 12_345_678,
    },
    durationMs: transcription.durationMs,
    addedAt: Date.now(),
  };

  return { asset, transcription };
}

const SAMPLE_LINES = [
  "Olá, tudo bem? Hoje eu vou mostrar como o Pink Cut funciona.",
  "A gente pega o vídeo e ele transcreve tudo automaticamente.",
  "Depois você edita o texto como se fosse um documento.",
  "As pausas viram o sinal de colcheia que vocês veem aqui.",
  "E o melhor de tudo, tudo roda local na sua máquina.",
  "Sem enviar nada pra servidor, sem perder tempo.",
  "Bora editar o meu vídeo de teste então?",
  "Vou cortar esse pedaço porque ficou meio enrolado.",
  "Agora ficou bem mais limpo, dá pra entender de primeira.",
  "Esse é o poder do Pink Cut, galera. Até a próxima!",
];
