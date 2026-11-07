# 🎻 Violin Teacher

A friendly violin teacher for **iPhone, Android and the web**, built with React Native (Expo).
It teaches you from day one, listens to you play through the microphone, and helps you learn
**the sheet music you upload**.

## What it does

| | |
|---|---|
| **Teacher** | Today's lesson, your practice streak, recent pieces and a daily tip. |
| **Lessons** | A beginner course: holding the violin, the bow hold, open strings, finger patterns on each string, D and G major scales, and first songs. Lessons with 🎤 exercises check your playing through the microphone. |
| **My Music** | Add the music you're learning: upload a file, **take a photo of your sheet music**, or type the notes. |
| **Listening practice** | Each note is shown on a staff with the **string and finger** to use, plus a fingerboard diagram of where to press. The app plays the note for you and **listens as you play**. It tells you if you're sharp ("slide back toward the scroll"), flat ("move toward the bridge"), on the wrong string, or in the wrong octave, and moves on once you hold the note in tune. |
| **Lesson notes** | After each run-through: first-try accuracy, whether you tend to play sharp or flat, your trickiest notes, and a "drill tricky notes" exercise. |
| **Tuner** | Microphone tuner with peg and fine-tuner advice for G, D, A and E, plus reference tones. |

### Adding your notes

* **MusicXML** (`.musicxml`, `.xml`, compressed `.mxl`): export it from MuseScore, Finale, Sibelius, Dorico, flat.io, etc. This is the best option.
* **ABC notation** (`.abc`), or paste ABC text.
* **Note list**: type or paste something like `D4 E4 F#4 G4 A4:2 R B4/2`
  (`:2` = 2 beats, `/2` = half a beat, `R` = rest).
* **Photo of sheet music** (camera or photo library): the photo is shown above a tap-to-enter note pad
  laid out by string and finger, so you can transcribe the notes and then practise them.
  The app does not read photos automatically, and PDFs aren't supported, so take a photo or screenshot of the page instead.

Two sample pieces (also in `samples/`) can be added from the My Music tab.

## Running it

```bash
npm install
npm run web          # opens in your browser
npm start            # then scan the QR code / press i or a for a simulator
```

### On your phone

* **Expo Go** (quickest): install *Expo Go* from the App Store or Play Store, run `npm start`
  and scan the QR code. The app uses only Expo modules (expo-audio for the microphone and
  tones). If your Expo Go build doesn't support live microphone streaming yet, use a
  development build instead.
* **Development build** (installs like a normal app): `npx expo run:ios` / `npx expo run:android`
  with Xcode / Android Studio, or build in the cloud with `npx eas-cli@latest build --profile development`.
* **Store builds**: `npx eas-cli@latest build` and `npx eas-cli@latest submit`.

### On the web

The included workflow (`.github/workflows/pages.yml`) typechecks, lints, tests and publishes the
web app to GitHub Pages whenever the default branch changes. Turn it on in **Settings → Pages → Source:
GitHub Actions**, then open `https://<user>.github.io/violin_teacher/` on any device. Browsers
only allow the microphone over `https://` or `localhost`.

## Privacy

Everything stays on your device. Microphone audio is analysed live and never recorded or
uploaded. Pieces, progress and settings are saved with AsyncStorage. Photos are saved in the
app's documents folder (in browser storage on the web).

## Development

```bash
npm test             # Jest unit tests (parsers, fingering, pitch detection, coaching, synth)
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
npm run build:web    # static web build in dist/
```

```
src/app/                    screens (Expo Router)
  (tabs)/                   Teacher, Lessons, My Music, Tuner, Settings
  lesson/[id].tsx           lesson reader
  practice/[kind]/[id].tsx  listening practice for a lesson exercise or a piece
  edit/[id].tsx             note editor / photo transcriber
src/lib/                    platform-independent logic (unit tested)
  notes.ts                  note names, MIDI, first-position fingering
  parsers.ts                MusicXML / MXL / ABC / note-list parsers
  pitch.ts                  autocorrelation pitch detection
  coach.ts                  the teacher: intonation feedback, sessions, lesson notes
  wav.ts                    violin-like tone synthesis to WAV
  lessons.ts, samples.ts    course content and sample pieces
src/audio/                  usePitch / tone: .ts = iOS & Android (expo-audio), .web.ts = Web Audio
src/state/                  app state (AsyncStorage) and file helpers
src/components/             Staff and Fingerboard (react-native-svg), meter, UI kit
```
