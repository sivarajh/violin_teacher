// A beginner violin course. Lesson bodies use a tiny markup rendered by <RichText>:
//   "## Heading", "- bullet", "1. numbered", "> teacher tip", blank line = paragraph, **bold**.

export type Lesson = {
  id: string;
  title: string;
  level: string;
  summary: string;
  body: string;
  /** Note list practised with the microphone. */
  exercise?: string;
};

export const LESSONS: Lesson[] = [
  {
    id: 'setup',
    title: 'Meet your violin',
    level: 'Day 1',
    summary: 'Parts of the violin, holding it, and caring for it.',
    body: `Welcome! I'll be your teacher. Before we play a single note, let's get to know the instrument.

## Parts you'll hear me talk about
- **Scroll** and **pegs** — at the far end; pegs make big tuning changes.
- **Fingerboard** — the black board your left fingers press on. There are no frets, so your ear decides where notes are.
- **Bridge** — holds the strings up. **Fine tuners** on the tailpiece make small tuning changes.
- **Strings** — from lowest to highest: **G, D, A, E**. A handy rhyme: "**G**ood **D**ogs **A**lways **E**at."

## Holding the violin
1. Stand tall, feet shoulder-width apart, weight balanced.
2. Place the violin on your left collarbone, jaw resting on the chinrest. Look down the strings toward the scroll.
3. The violin should stay up with just the weight of your head — try letting go with your left hand for a moment.
4. Keep your left wrist straight (not collapsed against the neck), thumb soft and opposite your 1st/2nd finger.

## Care
Wipe rosin dust off the strings after playing, loosen the bow hair before putting it away, and keep the violin out of hot cars.

> Practise holding position for 1 minute at a time in front of a mirror. Comfort first — tension is the enemy of good sound.`,
  },
  {
    id: 'bow',
    title: 'The bow hold & first sounds',
    level: 'Day 1',
    summary: 'A relaxed bow hold and straight bowing on open strings.',
    body: `## Bow hold, step by step
1. Let your right hand hang relaxed. Notice the natural curve — keep it.
2. **Thumb**: bent, touching the stick where the frog meets the grip.
3. **Middle fingers**: drape over the stick, resting near the middle crease.
4. **Index finger**: rests on the stick between the first and second knuckle — this is how you add weight.
5. **Pinky**: curved, tip on top of the stick. It balances the bow.

## Your first sound
Rosin the bow (5–6 smooth strokes along the hair). Place the bow on the **A string**, halfway between the bridge and the fingerboard. Pull slowly, keeping the bow **parallel to the bridge**.
- "Down bow" (⊓) pulls toward the tip. "Up bow" (V) pushes toward the frog.
- Scratchy? Use less pressure or more speed. Airy or whistling? Add a little arm weight.
- To change strings, change your **elbow height**: highest for G, lowest for E.

> Watch the bow in a mirror and keep it straight. Four slow down-bows and up-bows on each string make a great warm-up.`,
  },
  {
    id: 'open-strings',
    title: 'Open strings: G D A E',
    level: 'Week 1',
    summary: "Play each open string. I'll listen and check your tuning.",
    body: `Open strings are notes played without fingers. They're your reference points for everything else.

In this exercise, play each open string with long, steady bows. I'll listen through your microphone and move on when I hear the right note held steadily.
- Hear a different note? You may be touching the neighbouring string — adjust your elbow height.
- If your open strings sound sharp or flat, tune up first in the **Tuner** tab.`,
    exercise: 'G3:2 D4:2 A4:2 E5:2 A4:2 D4:2 G3:2',
  },
  {
    id: 'a-string',
    title: 'Fingers on the A string',
    level: 'Week 2',
    summary: 'A, B, C♯, D — your first finger pattern.',
    body: `Now your left hand joins in. Fingers are numbered: **1** = index, **2** = middle, **3** = ring, **4** = pinky. Open string is **0**.
- **1st finger → B**: about 3–4 cm from the nut (many beginners put a tape here).
- **2nd finger → C♯**: "high 2" — it sits close to where the 3rd finger goes.
- **3rd finger → D**: touches the 2nd finger. It should sound like your open D string, an octave higher.

Press with your fingertips, curved as if holding a small ball. Keep earlier fingers down as you add new ones.

> If a note is **sharp** (too high), slide the finger slightly back toward the scroll. If it's **flat** (too low), move toward the bridge. I'll tell you which as you play.`,
    exercise: 'A4 B4 C#5 D5 D5 C#5 B4 A4:2',
  },
  {
    id: 'd-string',
    title: 'Fingers on the D string',
    level: 'Week 2',
    summary: 'D, E, F♯, G — the same pattern, one string lower.',
    body: `Same finger pattern as the A string, one string over: **0 = D, 1 = E, 2 = F♯ (high 2), 3 = G**.

Your 3rd-finger G should ring together with the open G string — a sign that it's in tune.`,
    exercise: 'D4 E4 F#4 G4 G4 F#4 E4 D4:2',
  },
  {
    id: 'd-major',
    title: 'D major scale',
    level: 'Week 3',
    summary: 'Connect the D and A strings into one scale.',
    body: `Put the last two lessons together and you have the **D major scale** — the most common first scale on the violin.

D string: D E F♯ G, then A string: A B C♯ D. Change strings smoothly by moving your elbow, not your wrist.

> Play scales slowly with full bows. Playing in tune is built by slow, careful listening.`,
    exercise: 'D4 E4 F#4 G4 A4 B4 C#5 D5:2 C#5 B4 A4 G4 F#4 E4 D4:2',
  },
  {
    id: 'twinkle',
    title: 'First song: Twinkle Twinkle',
    level: 'Week 3',
    summary: 'A famous first tune using the A and E strings.',
    body: `A traditional melody in A major. You'll use the A string (A, B, C♯, D), the open E string, and the 1st finger on E (F♯).
- E string, 1st finger = **F♯**.
- Keep the bow on the string between notes to connect them.`,
    exercise: 'A4 A4 E5 E5 F#5 F#5 E5:2 D5 D5 C#5 C#5 B4 B4 A4:2 E5 E5 D5 D5 C#5 C#5 B4:2 E5 E5 D5 D5 C#5 C#5 B4:2 A4 A4 E5 E5 F#5 F#5 E5:2 D5 D5 C#5 C#5 B4 B4 A4:2',
  },
  {
    id: 'g-e-strings',
    title: 'The G and E strings',
    level: 'Week 4',
    summary: 'Extend the pattern to the outer strings.',
    body: `With the same high-2 pattern: **G string** = G A B C, **E string** = E F♯ G♯ A.

On the G string raise your right elbow higher; on the E string lower it, and keep your left fingers curved so they don't touch the A string.`,
    exercise: 'G3 A3 B3 C4 D4:2 E5 F#5 G#5 A5 E5:2',
  },
  {
    id: 'g-major',
    title: 'G major scale & low 2',
    level: 'Week 5',
    summary: 'Two octaves, and the "low 2" finger pattern.',
    body: `The G major scale uses a new shape on the A and E strings: **low 2nd finger** (C natural on A, G natural on E), where the 2nd finger touches the 1st.
- G string: G A B C (high 2)
- D string: D E F♯ G (high 2)
- A string: A B **C** D (low 2!)
- E string: E F♯ **G** (low 2)

> Say the finger pattern out loud — "high two, high two, low two" — before you play.`,
    exercise: 'G3 A3 B3 C4 D4 E4 F#4 G4 A4 B4 C5 D5 E5 F#5 G5:2 F#5 E5 D5 C5 B4 A4 G4 F#4 E4 D4 C4 B3 A3 G3:2',
  },
  {
    id: 'your-music',
    title: 'Practising your own music',
    level: 'Any time',
    summary: 'How to use "My Music" to learn the pieces you upload.',
    body: `Add the sheet music you're learning in the **My Music** tab. I can read:
- **MusicXML** (.musicxml, .xml, .mxl) — export it from MuseScore, Finale, Sibelius, Dorico or flat.io.
- **ABC notation** (.abc) — thousands of folk tunes are free in this format.
- **A note list** you type, like D4 E4 F#4:2 (":2" means two beats).
- **A photo** of sheet music — take one with your camera. I'll show it above a note pad so you can tap in the notes, then we'll practise them together.

For every piece I'll show each note on the staff, tell you which string and finger to use, play it for you, and listen as you play it back.

> Learn a new piece in small chunks. Tap a note on the staff to start from there and repeat the tricky bar until it feels easy.`,
  },
];
