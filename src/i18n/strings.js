/** @typedef {'en' | 'hy'} Locale */

/** @type {Record<string, { en: string; hy: string }>} */
export const STR = {
  title: { en: "Damaged limb", hy: "Վնասված վերջույթ" },
  subtitle: {
    en: "Select which side is affected. The other side will lead movement.",
    hy: "Ընտրեք, թե որ կողմն է վնասված։ Մյուս կողմը կառաջնորդի շարժումը։",
  },
  left: { en: "Right", hy: "Աջ" },
  right: { en: "Left", hy: "Ձախ" },
  startGame: { en: "Start game", hy: "Սկսել խաղը" },
  cameraOn: { en: "Camera on", hy: "Միացնել տեսախցիկը" },
  cameraOff: { en: "Camera off", hy: "Անջատել տեսախցիկը" },
  langEn: { en: "EN", hy: "EN" },
  langHy: { en: "HY", hy: "ՀՅ" },
  score: { en: "Score", hy: "Միավորներ" },
  perfect: { en: "Great!", hy: "Հիանալի է" },
  late: { en: "Late", hy: "Ուշ" },
  miss: { en: "Missed", hy: "Բաց թողնված" },
  resultsTitle: { en: "Session complete", hy: "Ավարտված սեսիա" },
  resultsAccuracy: {
    en: "Movement correctness: {pct}%",
    hy: "Շարժման ճշգրտություն՝ {pct}%",
  },
  playAgain: { en: "Play again", hy: "Խաղալ կրկին" },
  needLimb: { en: "Choose left or right to continue.", hy: "Ընտրեք ձախ կամ աջ՝ շարունակելու համար։" },
  loadingCamera: { en: "Preparing camera…", hy: "Պատրաստվում է տեսախցիկը…" },
  tutorialHint: {
    en: "Watch the short clip, then tap ✕ to begin.",
    hy: "Դիտեք կարճ տեսանյութը, ապա սեղմեք ✕՝ սկսելու համար։",
  },
  gamePausedTitle: { en: "Paused", hy: "Դադար" },
  resumeGame: { en: "Resume", hy: "Շարունակել" },
  fistHint: {
    en: "Close your working hand into a fist when the marker meets the circle.",
    hy: "Փակեք աշխատող ձեռքը, երբ նշիչը հասնի շրջանին։",
  },
  characterLabel: { en: "Character", hy: "Կերպար" },
  characterNext: { en: "Next character", hy: "Հաջորդ կերպարը" },
  characterPrev: { en: "Previous character", hy: "Նախորդ կերպարը" },
  lobbyPreviewLeft: {
    en: "Preview: your right arm and hand (healthy side) match the avatar's right side on screen. Cues use that side; the damaged left side mirrors it when mirror mode is on.",
    hy: "Նախադիտում՝ ձեր աջ ձեռքը և ուսը (առողջ կողմը) համընկնում են էկրանին ավատարի աջ կողմի հետ։ Հուշումները այդ կողմով են, իսկ վնասված ձախը հայելային է, երբ ռեժիմը միացված է։",
  },
  lobbyPreviewRight: {
    en: "Preview: your left arm and hand (healthy side) match the avatar's left side on screen. Cues use that side; the damaged right side mirrors it when mirror mode is on.",
    hy: "Նախադիտում՝ ձեր ձախ ձեռքը և ուսը (առողջ կողմը) համընկնում են էկրանին ավատարի ձախ կողմի հետ։ Հուշումները այդ կողմով են, իսկ վնասված աջը հայելային է, երբ ռեժիմը միացված է։",
  },
  orchestraZoneLeft: { en: "Strings left", hy: "Ձախ խումբ" },
  orchestraZoneCenter: { en: "Center", hy: "Կենտրոն" },
  orchestraZoneRight: { en: "Strings right", hy: "Աջ խումբ" },
  orchestraVolume: { en: "Music (hands)", hy: "Երաժշտություն (ձեռքեր)" },
  orchestraGoalTitle: { en: "Conductor goal", hy: "Դիրիժորի նպատակ" },
  orchestraGoalHint: {
    en: "Keep wrists high on camera for 3 seconds (meter on the right) — bonus score. Raising hands also makes the track louder.",
    hy: "Պահեք մանրաձիգները բարձր տեսախցիկում 3 վայրկյան (մետրը աջ կողմում)՝ բոնուս միավորների համար։ Ձեռքերը բարձրացնելը նաև ուժեղացնում է երաժշտությունը։",
  },
  orchestraGoalDone: {
    en: "Goal complete — bonus points added.",
    hy: "Նպատակը կատարված է — ավելացվել են բոնուս միավորներ։",
  },
  orchestraChallengeRaise: { en: "Raise hands", hy: "Բարձրացրեք ձեռքերը" },
  orchestraChallengeCenter: { en: "Hold center", hy: "Պահեք կենտրոնում" },
  orchestraChallengeStreak: { en: "Hit streak", hy: "Հաջող շարք" },
  playGoal: { en: "Hit cues on beat and raise arm to score", hy: "Հուշումները ճիշտ պահին և դինամիկայի կառավարում" },
  timeLeft: { en: "Time left:", hy: "Մնաց:" },
  finishing: { en: "Finishing...", hy: "Ավարտվում է..." },
  energyLabel: { en: "Energy:", hy: "Էներգիա՝" },
  goalReady: { en: "Performance Ready", hy: "Պատրաստ է" },
};

/** @param {Locale} locale @param {keyof typeof STR} key */
export function t(locale, key) {
  return STR[key][locale] ?? STR[key].en;
}
