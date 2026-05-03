// Level-aware song data: Level 1 = Saint-Saëns The Swan (Carnival),
// Level 2 = Eine Kleine Nachtmusik, Level 3 = Yarkhushta-style folk,
// Level 4 = Swan Lake excerpt, Level 5 = Nutcracker Pas de deux excerpt
// (MIDI → JSON via scripts/midiToOrchestraJson.mjs, yarn build:level1 / build:level3 / build:level4).
import carnivalSwanSong from "./orchestra/carnivalSwanSong.json";
import semiSong from "./orchestra/semiSong.json";
import yarkhushtaSong from "./orchestra/yarkhushtaSong.json";
import swanLakeSong from "./orchestra/swanLakeSong.json";
import nutcrackerPasSong from "./orchestra/nutcrackerPasSong.json";

const LEVEL_SONG = {
  level1: carnivalSwanSong,
  level2: semiSong,
  level3: yarkhushtaSong,
  level4: swanLakeSong,
  level5: nutcrackerPasSong,
};

function makeMeta(song) {
  return {
    bpm: song.header.bpm,
    timeSignature: song.header.timeSignature,
    durationSec: song.duration,
    title: song.header.name,
  };
}

function makeTracks(song) {
  return song.tracks.map((track) => ({
    id: track.id,
    instrument: track.instrument,
    notes: track.notes.map((n) => ({
      time: n.time,
      duration: n.duration,
      velocity: n.velocity,
      name: n.name,
      ...(typeof n.midi === "number" ? { midi: n.midi } : {}),
    })),
  }));
}

export function getOrchestraMeta(levelId) {
  return makeMeta(LEVEL_SONG[levelId] || carnivalSwanSong);
}

export function getOrchestraTracks(levelId) {
  return makeTracks(LEVEL_SONG[levelId] || carnivalSwanSong);
}

export const ORCHESTRA_META = makeMeta(carnivalSwanSong);
export const ORCHESTRA_TRACKS = makeTracks(carnivalSwanSong);

export const ORCHESTRA_ZONE_GROUPS = [
  ["violin", "string ensemble 1"],
  ["viola"],
  ["cello", "contrabass"],
];

export function instrumentsForZone(zone) {
  return ORCHESTRA_ZONE_GROUPS[zone] || ORCHESTRA_ZONE_GROUPS[1];
}
