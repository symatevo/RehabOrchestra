import { publicUrl } from "../utils/publicUrl.js";

export const STRING_SAMPLE_LIBRARY = {
  // Open sample source mirrored into project-local public assets.
  source: "FluidR3_GM (midi-js-soundfonts)",
  instruments: {
    violin: {
      urls: {
        C4: "violin/C4.mp3",
        G4: "violin/G4.mp3",
        C5: "violin/C5.mp3",
        G5: "violin/G5.mp3",
      },
      release: 0.62,
      attack: 0.015,
    },
    "string ensemble 1": {
      // Reuse violin section samples for ensemble layer.
      urls: {
        C4: "violin/C4.mp3",
        G4: "violin/G4.mp3",
        C5: "violin/C5.mp3",
        G5: "violin/G5.mp3",
      },
      release: 0.72,
      attack: 0.02,
    },
    viola: {
      urls: {
        C3: "viola/C3.mp3",
        G3: "viola/G3.mp3",
        C4: "viola/C4.mp3",
        G4: "viola/G4.mp3",
      },
      release: 0.68,
      attack: 0.018,
    },
    cello: {
      urls: {
        C2: "cello/C2.mp3",
        G2: "cello/G2.mp3",
        C3: "cello/C3.mp3",
        G3: "cello/G3.mp3",
      },
      release: 0.78,
      attack: 0.02,
    },
    contrabass: {
      urls: {
        C1: "contrabass/C1.mp3",
        G1: "contrabass/G1.mp3",
        C2: "contrabass/C2.mp3",
        G2: "contrabass/G2.mp3",
      },
      release: 0.9,
      attack: 0.024,
    },
  },
};

export function getSamplerConfig(instrument) {
  const cfg = STRING_SAMPLE_LIBRARY.instruments[instrument];
  if (!cfg) return null;
  const urls = Object.fromEntries(
    Object.entries(cfg.urls).map(([note, relPath]) => [
      note,
      publicUrl(`music/samples/strings/${relPath}`),
    ]),
  );
  return {
    urls,
    release: cfg.release,
    attack: cfg.attack,
  };
}
