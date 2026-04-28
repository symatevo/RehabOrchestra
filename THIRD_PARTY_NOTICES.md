# Third-Party Notices

## semi-conductor-master inspired logic

Parts of the orchestra scheduling/control approach in this project are adapted from:

- https://github.com/googlecreativelab/semi-conductor

Original files referenced:

- `src/scripts/audio-player.js`
- `src/assets/song.json`
- `src/assets/samples.json`

License: Apache License 2.0

Copyright 2019 Google LLC

This project does not copy or modify the reference repository in place.
Adapted logic and data are integrated into this codebase for gameplay use.

## Tchaikovsky MIDI sources (Levels 3–4)

These files are third-party arrangements used only as inputs to
`scripts/midiToOrchestraJson.mjs` (see `yarn build:level3` / `yarn build:level4`):

- **Level 3:** `public/music/song/Midi/tchaikovsky_swan_lake_05_(c)lucarelli.mid` →
  `src/data/orchestra/swanLakeSong.json` (filename suggests a Lucarelli edition).
- **Level 4:** `public/music/song/Midi/tchaikovsky_nutcracker_act-2_14_pas_des_deux_(c)yogore.mid` →
  `src/data/orchestra/nutcrackerPasSong.json`.

Verify licensing and attribution for your distribution.
