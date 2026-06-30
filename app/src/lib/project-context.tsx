/**
 * Project context — single source of truth for "what video is loaded?" and
 * "what has been transcribed so far?".
 *
 * The whole app (upload form, left assets sidebar, central editor surface,
 * header info, footer menus) reads from this. We keep it tiny on purpose —
 * no Zustand, no Redux, just a React Context + reducer. If the app grows and
 * we need selectors or persistence, we'll graduate to a real store then.
 *
 * AGENTS.md says the editor is text-based: silences become the 𝄾 quarter
 * rest. The `Transcription` shape here is what the Rust pipeline
 * (`parakeet-rs` + ffmpeg + our silence classifier in
 * `src-tauri/src/transcription.rs`) emits, mirrored 1:1 to the JS layer
 * by `features/transcription/transcribe.ts`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { VideoFile } from "@/features/media/types";
import type { Transcription } from "@/features/transcription/types";

/** A single asset card. We allow multiple so the sidebar can scale later. */
export type ProjectAsset = {
  id: string;
  file: VideoFile;
  /** Cached duration in ms; `null` until introspection lands. */
  durationMs: number | null;
  addedAt: number;
};

type State = {
  assets: ProjectAsset[];
  activeAssetId: string | null;
  /** Latest transcription result for the active asset. */
  transcription: Transcription | null;
  /** Per-asset transcription cache, so switching back is instant. */
  transcriptions: Record<string, Transcription>;
};

type Action =
  | { type: "add-asset"; asset: ProjectAsset }
  | { type: "remove-asset"; id: string }
  | { type: "set-active"; id: string | null }
  | { type: "set-transcription"; assetId: string; transcription: Transcription }
  | { type: "reset" };

const initialState: State = {
  assets: [],
  activeAssetId: null,
  transcription: null,
  transcriptions: {},
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add-asset": {
      const isFirst = state.assets.length === 0;
      return {
        ...state,
        assets: [...state.assets, action.asset],
        activeAssetId: isFirst ? action.asset.id : state.activeAssetId,
      };
    }
    case "remove-asset": {
      const remaining = state.assets.filter((a) => a.id !== action.id);
      const wasActive = state.activeAssetId === action.id;
      const next = { ...state.transcriptions };
      delete next[action.id];
      return {
        ...state,
        assets: remaining,
        activeAssetId: wasActive
          ? (remaining[0]?.id ?? null)
          : state.activeAssetId,
        transcriptions: next,
        transcription: wasActive
          ? remaining[0]
            ? (state.transcriptions[remaining[0].id] ?? null)
            : null
          : state.transcription,
      };
    }
    case "set-active": {
      return {
        ...state,
        activeAssetId: action.id,
        transcription: action.id
          ? (state.transcriptions[action.id] ?? null)
          : null,
      };
    }
    case "set-transcription": {
      return {
        ...state,
        transcriptions: {
          ...state.transcriptions,
          [action.assetId]: action.transcription,
        },
        // Mirror onto the convenience field if it matches the active asset.
        transcription:
          state.activeAssetId === action.assetId
            ? action.transcription
            : state.transcription,
      };
    }
    case "reset": {
      return initialState;
    }
  }
}

type ProjectContextValue = {
  assets: ProjectAsset[];
  activeAsset: ProjectAsset | null;
  activeAssetId: string | null;
  transcription: Transcription | null;

  addAsset: (file: VideoFile) => ProjectAsset;
  removeAsset: (id: string) => void;
  setActive: (id: string | null) => void;
  setTranscription: (assetId: string, transcription: Transcription) => void;
  reset: () => void;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

/**
 * Generates a stable, sortable id for a new asset. We avoid a UUID dep —
 * timestamp + path-hash is enough to keep React keys unique within a
 * session.
 */
function makeAssetId(file: VideoFile): string {
  const stamp = Date.now().toString(36);
  let h = 0;
  for (let i = 0; i < file.path.length; i++) {
    h = (h * 31 + file.path.charCodeAt(i)) | 0;
  }
  return `asset_${stamp}_${(h >>> 0).toString(36)}`;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addAsset = useCallback((file: VideoFile): ProjectAsset => {
    const asset: ProjectAsset = {
      id: makeAssetId(file),
      file,
      durationMs: null,
      addedAt: Date.now(),
    };
    dispatch({ type: "add-asset", asset });
    return asset;
  }, []);

  const removeAsset = useCallback((id: string) => {
    dispatch({ type: "remove-asset", id });
  }, []);

  const setActive = useCallback((id: string | null) => {
    dispatch({ type: "set-active", id });
  }, []);

  const setTranscription = useCallback(
    (assetId: string, transcription: Transcription) => {
      dispatch({ type: "set-transcription", assetId, transcription });
    },
    [],
  );

  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  const value = useMemo<ProjectContextValue>(() => {
    const activeAsset =
      state.assets.find((a) => a.id === state.activeAssetId) ?? null;
    return {
      assets: state.assets,
      activeAsset,
      activeAssetId: state.activeAssetId,
      transcription: state.transcription,
      addAsset,
      removeAsset,
      setActive,
      setTranscription,
      reset,
    };
  }, [state, addAsset, removeAsset, setActive, setTranscription, reset]);

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used within a <ProjectProvider>");
  }
  return ctx;
}
