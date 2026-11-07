// A beginner violin course. Each lesson has teaching text and an optional
// practice exercise (a note list) that runs through the listening practice engine.

export const LESSONS = [
  {
    id: 'setup',
    title: 'Meet your violin',
    level: 'Day 1',
    summary: 'Parts of the violin, holding it, and caring for it.',
    body: `
<p>Welcome! I'll be your teacher. Before we play a single note, let's get to know the instrument.</p>
<h4>Parts you'll hear me talk about</h4>
<ul>
  <li><b>Scroll</b> and <b>pegs</b> — at the far end; pegs do big tuning changes.</li>
  <li><b>Fingerboard</b> — the black board your left fingers press on. There are no frets, so <em>your ear</em> decides where notes are.</li>
  <li><b>Bridge</b> — holds the strings up. Fine tuners on the tailpiece make small tuning changes.</li>
  <li><b>Strings</b> — from lowest to highest: <b>G, D, A, E</b>. A handy rhyme: "<b>G</b>ood <b>D</b>ogs <b>A</b>lways <b>E</b>at."</li>
</ul>
<h4>Holding the violin</h4>
<ol>
  <li>Stand tall, feet shoulder-width apart, weight balanced.</li>
  <li>Place the violin on your left collarbone, with your jaw resting on the chinrest. Look down the strings toward the scroll.</li>
  <li>The violin should stay up with only your head's weight — try letting go with your left hand for a moment.</li>
  <li>Left wrist straight (not collapsed against the neck), thumb soft and opposite your 1st/2nd finger.</li>
</ol>
<h4>Care</h4>
<p>Wipe rosin dust off the strings after playing, loosen the bow hair before putting it away, and keep the violin out of hot cars.</p>
<div class="tip">Teacher's tip: Practice holding position for 1 minute at a time in front of a mirror. Comfort first — tension is the enemy of good sound.</div>`,
  },
  {
    id: 'bow',
    title: 'The bow hold & first sounds',
    level: 'Day 1',
    summary: 'A relaxed bow hold and straight bowing on open strings.',
    body: `
<h4>Bow hold (step by step)</h4>
<ol>
  <li>Let your right hand hang relaxed. Notice the natural curve — keep it.</li>
  <li><b>Thumb</b>: bent, touching the stick where the frog meets the leather/grip.</li>
  <li><b>Middle fingers</b>: drape over the stick, the stick resting near the middle crease.</li>
  <li><b>Index finger</b>: rests on the stick between the first and second knuckle — this is how you put weight in.</li>
  <li><b>Pinky</b>: curved, tip on top of the stick. It balances the bow.</li>
</ol>
<h4>Your first sound</h4>
<p>Rosin the bow (5–6 smooth strokes along the hair). Place the bow on the <b>A string</b>, halfway between the bridge and the fingerboard. Pull the bow slowly, keeping it <b>parallel to the bridge</b>.</p>
<ul>
  <li>"Down bow" (⊓) pulls toward the tip. "Up bow" (V) pushes toward the frog.</li>
  <li>Scratchy? Use less pressure or more speed. Airy/whistling? Use a little more arm weight.</li>
  <li>To change strings, change your <em>elbow height</em>: G is highest, E is lowest.</li>
</ul>
<div class="tip">Teacher's tip: Practice in front of a mirror and watch that the bow stays straight. Four slow down-bows and up-bows per string is a great warm-up.</div>`,
  },
  {
    id: 'open-strings',
    title: 'Open strings: G D A E',
    level: 'Week 1',
    summary: 'Play each open string. I\'ll listen and check your tuning.',
    body: `
<p>Open strings are notes played without fingers. They're your reference points for everything else.</p>
<p>In this exercise, play each open string with long, steady bows. I'll listen through your microphone and move on when I hear the right note held steadily.</p>
<ul>
  <li>Hear a different note? You may be touching the neighbouring string — adjust your elbow height.</li>
  <li>If your open strings sound sharp or flat, use the <b>Tuner</b> tab to tune first.</li>
</ul>`,
    exercise: 'G3:2 D4:2 A4:2 E5:2 A4:2 D4:2 G3:2',
  },
  {
    id: 'a-string',
    title: 'Fingers on the A string',
    level: 'Week 2',
    summary: 'A, B, C♯, D — your first finger pattern.',
    body: `
<p>Now your left hand joins in. Fingers are numbered: <b>1</b> = index, <b>2</b> = middle, <b>3</b> = ring, <b>4</b> = pinky. (Open string is 0.)</p>
<ul>
  <li><b>1st finger → B</b>: about 3–4 cm from the nut (many beginners use a tape here).</li>
  <li><b>2nd finger → C♯</b>: "high 2" — it sits close to where the 3rd finger goes.</li>
  <li><b>3rd finger → D</b>: touches the 2nd finger. D should sound the same as your open D string, an octave higher.</li>
</ul>
<p>Press with fingertips, curved like you're holding a small ball. Keep earlier fingers down as you add new ones.</p>
<div class="tip">Teacher's tip: If a note is <b>sharp</b> (too high), slide the finger slightly back toward the scroll. If <b>flat</b> (too low), move toward the bridge. I'll tell you which as you play.</div>`,
    exercise: 'A4 B4 C#5 D5 D5 C#5 B4 A4:2',
  },
  {
    id: 'd-string',
    title: 'Fingers on the D string',
    level: 'Week 2',
    summary: 'D, E, F♯, G — the same pattern, one string lower.',
    body: `
<p>Same finger pattern as the A string, one string over: <b>0 = D, 1 = E, 2 = F♯ (high 2), 3 = G</b>.</p>
<p>Your 3rd finger G should ring together with the open G string — a sign that it is in tune.</p>`,
    exercise: 'D4 E4 F#4 G4 G4 F#4 E4 D4:2',
  },
  {
    id: 'd-major',
    title: 'D major scale',
    level: 'Week 3',
    summary: 'Connect the D and A strings into one scale.',
    body: `
<p>Combine the last two lessons and you have the <b>D major scale</b> — the most common first scale on the violin.</p>
<p>D string: D E F♯ G, then A string: A B C♯ D. Change string smoothly by moving your elbow, not your wrist.</p>
<div class="tip">Teacher's tip: Play scales slowly with full bows. Intonation (playing in tune) is built by slow, careful listening.</div>`,
    exercise: 'D4 E4 F#4 G4 A4 B4 C#5 D5:2 C#5 B4 A4 G4 F#4 E4 D4:2',
  },
  {
    id: 'twinkle',
    title: 'First song: Twinkle Twinkle',
    level: 'Week 3',
    summary: 'A famous first tune using the A and E strings.',
    body: `
<p>A traditional melody in A major. You'll use the A string (A, B, C♯, D) and the open E string, plus the 1st finger on E (F♯).</p>
<ul>
  <li>E string 1st finger = <b>F♯</b>.</li>
  <li>Keep the bow on the string between notes to connect them.</li>
</ul>`,
    exercise: 'A4 A4 E5 E5 F#5 F#5 E5:2 D5 D5 C#5 C#5 B4 B4 A4:2 E5 E5 D5 D5 C#5 C#5 B4:2 E5 E5 D5 D5 C#5 C#5 B4:2 A4 A4 E5 E5 F#5 F#5 E5:2 D5 D5 C#5 C#5 B4 B4 A4:2',
  },
  {
    id: 'g-e-strings',
    title: 'The G and E strings',
    level: 'Week 4',
    summary: 'Extend the pattern to the outer strings.',
    body: `
<p>With the same high-2 pattern: <b>G string</b> = G A B C, <b>E string</b> = E F♯ G♯ A.</p>
<p>On the G string, raise your right elbow higher; on the E string, lower it and keep the left fingers curved so they don't touch the A string.</p>`,
    exercise: 'G3 A3 B3 C4 D4:2 E5 F#5 G#5 A5 E5:2',
  },
  {
    id: 'g-major',
    title: 'G major scale & low 2',
    level: 'Week 5',
    summary: 'Two octaves, and the "low 2" finger pattern.',
    body: `
<p>The G major scale uses a new shape on the A and E strings: <b>low 2nd finger</b> (C natural on A, G natural on E), where the 2nd finger touches the 1st.</p>
<ul>
  <li>G string: G A B C (high 2)</li>
  <li>D string: D E F♯ G (high 2)</li>
  <li>A string: A B <b>C</b> D (low 2!)</li>
  <li>E string: E F♯ <b>G</b> (low 2)</li>
</ul>
<div class="tip">Teacher's tip: Say the finger pattern out loud — "high two, high two, low two" — before you play.</div>`,
    exercise: 'G3 A3 B3 C4 D4 E4 F#4 G4 A4 B4 C5 D5 E5 F#5 G5:2 F#5 E5 D5 C5 B4 A4 G4 F#4 E4 D4 C4 B3 A3 G3:2',
  },
  {
    id: 'your-music',
    title: 'Practising your own music',
    level: 'Any time',
    summary: 'How to use "My Music" to learn the pieces you upload.',
    body: `
<p>Upload the sheet music you're learning in the <b>My Music</b> tab. I can read:</p>
<ul>
  <li><b>MusicXML</b> (.musicxml, .xml, .mxl) — export it from MuseScore, Finale, Sibelius, Dorico, or flat.io.</li>
  <li><b>ABC notation</b> (.abc) — thousands of folk tunes are available free in this format.</li>
  <li><b>A note list</b> you type, like <code>D4 E4 F#4:2</code> (":2" means two beats).</li>
  <li><b>Photos or PDFs</b> of sheet music — I'll show them beside a note-entry pad so you can transcribe the notes, then we practise them together.</li>
</ul>
<p>For each piece I'll show every note on the staff, tell you which string and finger to use, play it for you, and listen as you play it back.</p>
<div class="tip">Teacher's tip: Learn a new piece in small chunks. Use the "Start from note" option to repeat the tricky bar until it feels easy.</div>`,
  },
];
