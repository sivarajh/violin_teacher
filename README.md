# 🎻 Violin Teacher

A friendly violin teacher that runs in your browser. It teaches you from your first day,
listens to you play through the microphone, and helps you learn **the sheet music you upload**.

## What it does

| | |
|---|---|
| **Teacher dashboard** | Today's lesson, your practice streak, recent pieces and a daily tip. |
| **Lessons** | A beginner course: holding the violin, the bow hold, open strings, finger patterns on each string, D and G major scales, and first songs. Lessons with exercises use the microphone to check your playing. |
| **My Music** | Upload the music you're learning and practise it note by note. |
| **Listening practice** | For each note, the app shows the note on a staff, which **string and finger** to use, and where to put the finger on a fingerboard diagram. It plays a reference tone and **listens to you**. It tells you if you're sharp ("slide back toward the scroll") or flat ("move toward the bridge"), on the wrong string, or in the wrong octave. It moves on once you hold the note in tune. |
| **Lesson notes** | After each run-through: first-try accuracy, whether you tend to play sharp or flat, your trickiest notes, and a "drill tricky notes" exercise. |
| **Tuner** | Microphone tuner with peg and fine-tuner advice for G, D, A and E, plus reference tones. |

### Uploading your notes

* **MusicXML** (`.musicxml`, `.xml`, compressed `.mxl`): export it from MuseScore, Finale, Sibelius, Dorico, flat.io, etc. This is the best option.
* **ABC notation** (`.abc`), or paste ABC text.
* **Note list**: type or paste something like `D4 E4 F#4 G4 A4:2 R B4/2`
  (`:2` = 2 beats, `/2` = half a beat, `R` = rest).
* **Photo or PDF of sheet music**: shown side by side with a tap-to-enter note pad laid out by
  string and finger, so you can transcribe the notes and then practise them. (Automatic
  reading of photos is not supported.)

Two sample pieces are included in `samples/` and can be added from the My Music page.

## Running it

It's a static site with no build step and no dependencies. Serve the folder over HTTP:

```bash
npm start            # or: python3 -m http.server 8080
```

Then open <http://localhost:8080>. Browsers only allow the microphone on `https://` or
`localhost`, so opening `index.html` straight from disk will not work.

### Use it on your phone or tablet

The included workflow (`.github/workflows/pages.yml`) runs the tests and publishes the app to
GitHub Pages whenever `main` changes. To turn it on, go to **Settings → Pages → Source:
GitHub Actions**. Then open `https://<user>.github.io/violin_teacher/` on any device.

## Privacy

Everything stays on your device. Microphone audio is analysed live in the browser and never
recorded or uploaded. Your pieces and progress are saved in the browser's local storage, and
uploaded images/PDFs in IndexedDB.

## Development

```bash
npm test             # node's built-in test runner, no installs needed
```

```
index.html          app shell
css/style.css       styles (light & dark)
js/app.js           views & routing (teacher, lessons, music, editor, practice, tuner, settings)
js/coach.js         the teacher: intonation feedback, practice sessions, lesson notes
js/lessons.js       the beginner curriculum
js/notes.js         note names, MIDI, first-position fingering
js/parsers.js       MusicXML / MXL / ABC / note-list parsers
js/pitch.js         autocorrelation pitch detection
js/audio.js         reference tones, playback, microphone listener
js/render.js        SVG staff and fingerboard
js/storage.js       localStorage + IndexedDB
samples/            example pieces
test/               unit tests
```
