# Game Design Document — JOULE JACKPOT
### *The Energy Quiz Show*

> Status: **Draft v0.5** · 2026-11-26
> Items marked **[DECIDE]** still need a decision.

### Changelog
- **v0.6:** PC only, Turso confirmed.
- **v0.5:** Hosting on Vercel, so the DB moves to Turso (SQLite-compatible; a local file in dev) and voice clips to Vercel Blob. Added a performance section with a 60 FPS target, budgets, techniques and auto-quality.
- **v0.4:** Timer pauses whenever an option is selected, and the AI host reconfirms every lock. A Double Chance miss is announced by the host before the timer resumes. Tamil is deferred. Voice is picked from a dropdown, but the final voice choice is on hold.
- **v0.3:** Title set to JOULE JACKPOT. 3 lifelines (Double Chance, Phone a Friend, Ask the AI); Swap removed. Ask the AI always says "50-50". Timer pauses during lifelines. Ladder starts at 10,000. ElevenLabs voice with a lip-synced pixel host. Tamil available when ElevenLabs is set up. Next.js only, with an embedded SQLite database.
- **v0.2:** AI host, no Firebase, wrong answer pays 0, timer on Q1–Q8, walk-away from Q9.
- **v0.1:** Initial draft.

---

## 1. Concept

**JOULE JACKPOT** is a single-player browser quiz show on a 3D stage with a pixel-art AI host, a live fake audience, light shows and heavy suspense. The player climbs a 16-step ladder of **Image Coins** by answering questions about **energy**: where it comes from, how it's created, converted, stored and used.

- **Genre:** solo quiz show; a scripted AI host runs everything
- **Platform:** **PC browser only** (Chrome/Edge, keyboard + mouse, projector friendly). Mobile is not supported.
- **Stack:** **Next.js** (App Router, route handlers) on **Vercel**, three.js via React Three Fiber, **SQLite-compatible DB** (local file in dev, Turso in production)
- **Performance:** 60 FPS target on a mid-range laptop (§14)
- **Voice:** ElevenLabs (optional, key set in admin)
- **Music:** pre-generated with ACE-Step
- **IP note:** the format and TV-show feel are ours to use. The name, logo, set, catchphrases, music and UI graphics are original: no KBC / "Who Wants to Be a Millionaire" branding, lines or music.

### Pillars
1. **Suspense:** dramatic pauses, lights and crowd reactions on every answer.
2. **Learn energy:** every question has a short explanation after the reveal.
3. **Feels like TV:** the host talks (and lip-syncs), the crowd reacts, and the lights tell the story.

---

## 2. Branding

- **Title:** JOULE JACKPOT. *Joule* is the unit of energy; *jackpot* is the prize.
- **Tagline:** "The Energy Quiz Show"
- **Logo concept** (`design/brand/logo.svg`): a gold coin with a lightning bolt cut through it, inside a hexagon ring, with chunky gold-to-orange wordmark text on deep navy and an electric-cyan glow. Hexagons repeat across the UI (option plates, lifeline icons).
- **Palette:** navy `#0B1033`, deep purple `#2A0E5C`, electric cyan `#22E1FF`, gold `#FFC83D`, orange `#FF7A1A`, correct green `#2EE66B`, wrong red `#FF3355`
- **Image Coins icon:** a small gold coin with a bolt, the same mark as the logo

---

## 3. Pages

| Page | Route | Who | Purpose |
|---|---|---|---|
| Game | `/` | Player | Start screen (name), 3D stage, play |
| Admin | `/admin` | Admin (password) | Settings: ladder, timers, ElevenLabs key and voice, voice cache |
| Question Bank | `/admin/questions` | Admin (password) | Add/edit/delete questions, tag difficulty, import/export |

### 3.1 Admin access
- One shared password, checked **on the server** against `ADMIN_PASSWORD` in `.env.local`. It is never in client code or this document.
- **Asked every time:** the session cookie is deleted when the browser closes, plus a 30 min idle timeout.
- A wrong password gets a generic error and a short delay.
- Risk: fine for local or event use, weak if the site is publicly reachable.

---

## 4. Core Loop

```
Start screen: name
 ─► AI host intro (crowd applause, light sweep)
   ┌────────────────────────────────────────────────────────────────┐
   │ AI host picks the next question (§6)                           │
   │ Host reads question (voice + lip sync if ElevenLabs set)       │
   │ 4 options appear · Q1–Q8: 45 s timer starts                    │
   │ Player: select option ─► TIMER PAUSES                          │
   │   AI host reconfirms: "B… are you sure? Shall we lock it?"     │
   │     Yes ─► locked          No ─► deselect, timer resumes       │
   │ Or: LIFELINE (timer paused) | WALK AWAY (Q9+)                  │
   │ Lock ─► host suspense line ─► lights + drumroll ─► reveal      │
   │   correct ─► coins up, cheer, explanation                      │
   │   wrong   ─► 0 coins, game over (unless Double Chance active)  │
   └────────────────────────────────────────────────────────────────┘
End: wrong answer / timeout (0 coins) | walk away (keep coins) | win Q16
```

The **server** checks the answer. The correct answer never reaches the browser before the reveal.

---

## 5. Ladder, Timer & Walk Away

| Q | Image Coins | Tier | Timer | Walk away? |
|---|---|---|---|---|
| 1 | 10,000 | Easy | 45 s | ❌ |
| 2 | 20,000 | Easy | 45 s | ❌ |
| 3 | 30,000 | Easy | 45 s | ❌ |
| 4 | 50,000 | Easy | 45 s | ❌ |
| 5 | 75,000 | Easy | 45 s | ❌ |
| 6 | 100,000 | Medium | 45 s | ❌ |
| 7 | 150,000 | Medium | 45 s | ❌ |
| 8 | 250,000 | Medium | 45 s | ❌ |
| 9 | 500,000 | Medium | none | ✅ |
| 10 | 1,000,000 | Medium | none | ✅ |
| 11 | 2,500,000 | Hard | none | ✅ |
| 12 | 5,000,000 | Hard | none | ✅ |
| 13 | 10,000,000 | Hard | none | ✅ |
| 14 | 25,000,000 | Hard | none | ✅ |
| 15 | 50,000,000 | Hard | none | ✅ |
| 16 | 100,000,000 | Hard (jackpot) | none | ✅ |

All values are editable in `/admin`.

- **Wrong answer = 0 Image Coins.** There are no safe levels.
- **Timeout on Q1–Q8 = wrong answer = 0.**
- **Walk away (Q9+):** the player sees the question and can quit before locking, keeping the previous level's coins (250,000 at Q9).
- **The timer pauses** whenever:
  - an option is selected and the AI host is reconfirming
  - a lifeline is playing out (Phone a Friend, Ask the AI)
  - the host is talking after a Double Chance miss
- **Reconfirm on every lock:** the AI host always asks before locking. The cinematic pause is part of the show.
- **Anti-stall rule:** with a pause on select, a player could select, cancel and repeat to freeze the clock. Proposal:
  - The reconfirm prompt has its own 10 s limit. If nobody answers, the selection cancels and the timer resumes.
  - **Max 1 cancel per question.** After that the host says "Final answer then!" and the next selection locks directly.
- Q1–Q8 are all-or-nothing by design, so a timeout on an easy question wipes the run.

---

## 6. AI Host — Question Selection

The host never judges difficulty. **Only the admin's tags count.**

For each level, the host takes the tier from §5:
1. Random **unused active** question **tagged** with that tier, preferring least-recently-used
2. Empty → random unused **untagged** question
3. Empty → nearest other tier (logged warning)
4. No repeats within a session

- If nothing is tagged, the whole session is random.
- The admin page shows **coverage** (easy / medium / hard / untagged counts) and warns when a tier has fewer questions than one session needs (5 easy, 5 medium, 6 hard).

---

## 7. AI Host — Behaviour

The host is "classical AI": a **scripted state machine** with a bank of dialogue lines. There's no LLM.

- **States:** Intro → AskQuestion → Waiting → (Lifeline) → Locked → Suspense → Reveal → Explain → Next / GameOver / Win
- **Lines:** 5–10 original English lines per state, picked at random without repeating the last one. Variables: `{name}`, `{coins}`, `{level}`, `{option}`.
- **Suspense scaling:** pauses grow with level (Q1 ≈ 2 s, Q16 ≈ 8 s).
- **Sprite animations:** idle, talk, point, lean in, laugh, sad.

### 7.1 Voice & lip sync (ElevenLabs)
- **No API key:** the host speaks through speech bubbles with typewriter text, and his mouth flaps in time with the typing.
- **API key set:** the host speaks host lines, questions, options and explanations aloud.
  - The server calls ElevenLabs. **The key never goes to the browser.**
  - Model: an ElevenLabs multilingual model, which keeps the Tamil option open later.
  - **Voice:** chosen in admin (§11). The final voice choice is **on hold**; a default voice is used until then.
  - **Lip sync:** the pixel host has 3–4 mouth frames (closed, half, open, wide). The frame is chosen from the live audio volume (Web Audio `AnalyserNode`). It's cheap and looks right on pixel art.
  - **Cache:** each generated clip is saved to Vercel Blob, keyed by text + voice. A line is generated once and replayed free after that. The admin page has a **"Pre-generate all voice"** button with a size/credit estimate.
  - **Failure:** if ElevenLabs errors or runs out of credits, the host falls back to bubble-only for that line and the game continues.

---

## 8. Lifelines (3)

Each is used once per session.

| # | Lifeline | How it works | Timer |
|---|---|---|---|
| 1 | **Double Chance** | Activated **before** locking. All 4 options stay. The player locks a first pick. If it's wrong, that plate turns red and is disabled, the crowd gasps, and the AI host announces the miss ("That's not it… but you still have one chance left!"). Then the player picks once more from the remaining 3. The lifeline is **used up even if the first pick is right.** | Pauses on selection and while the host announces the miss; resumes with the remaining time for the second pick |
| 2 | **Phone a Friend** | A 60 s countdown overlay. The player calls a real friend on their own phone. Game audio drops to a ticking bed. The overlay closes when time's up or the player taps "Done". | Main timer paused |
| 3 | **Ask the AI** | The host suggests one option and says the odds are 50-50, e.g. "My suggestion is B… but the odds are 50-50." It's up to the player to trust it. | Main timer paused |

**Ask the AI logic:** to match the "50-50" line, the suggestion is the correct option **50%** of the time; otherwise it's a random wrong option. The rate is configurable in admin.

Lifelines can be combined on the same question (e.g. Ask the AI, then Double Chance).

---

## 9. Languages

- **v1: English only.**
- **Tamil is deferred (on hold)** until someone is available to write the Tamil text. Planned design, for later:
  - Shown on the start screen only if ElevenLabs is configured
  - Tamil fields for questions and host lines, with an English fallback
  - A Tamil UI string file and a Tamil-capable font (e.g. Noto Sans Tamil)
- To keep that cheap later, v1 keeps all UI strings in one string file (no hard-coded text). Tamil will need its own question fields when it's built.

---

## 10. Question Bank

### 10.1 Content plan (200 questions)

| Category | Count |
|---|---|
| Origins of energy (Big Bang, stars, solar fusion) | 25 |
| Forms of energy (kinetic, potential, thermal, chemical…) | 25 |
| Laws & conversion (thermodynamics, efficiency) | 25 |
| Fossil fuels (formation, extraction, combustion) | 25 |
| Renewables (solar, wind, hydro, geothermal, biomass) | 35 |
| Nuclear (fission, fusion, reactors) | 20 |
| Electricity & grid | 25 |
| Storage & future (batteries, hydrogen) | 20 |
| **Total** | **200** |

Target tags: **Easy 70 / Medium 70 / Hard 60**.

### 10.2 Question fields

| Field | Type | Notes |
|---|---|---|
| `id` | int | auto |
| `text` | string | max ~140 chars |
| `options[4]` | string | max ~40 chars, unique |
| `correct_index` | 0–3 | server-only |
| `difficulty` | easy / medium / hard / null | null = untagged |
| `category` | enum | |
| `explanation` | string | shown after reveal |
| `status` | active / draft | |
| `times_used`, `last_used_at` | | LRU selection |
| `created_at`, `updated_at` | | |

### 10.3 Bank page
- Table: search, filters (difficulty incl. untagged, category, status)
- Quick-tag buttons per row (E / M / H / clear)
- Add/edit form with a live panel preview
- Import/export JSON and CSV
- Validation: 4 unique non-empty options, exactly one correct, length limits

---

## 11. Admin Settings Page

- **Ladder:** 16 coin values + tier per level
- **Timers:** question timer (45 s), last level with a timer (8), Phone a Friend (60 s), reconfirm prompt limit (10 s), max cancels per question (1)
- **Ask the AI:** chance the suggestion is correct (default 50%)
- **ElevenLabs:**
  - API key field (masked; saved server-side; "Test" button plays a sample)
  - **Voice picker:** a dropdown filled from the voices on that ElevenLabs account (fetched with the key), each with a ▶ preview, plus a manual "Voice ID" field. If the list can't be fetched, only the manual field is shown. Final voice choice: **on hold**.
  - Voice cache: size, "Pre-generate all", "Clear cache"
- **Audio:** master / music / crowd volume defaults

---

## 12. Presentation

### 12.1 Stage & UI
- **Set:** circular stage in navy/purple with energy accents: turbine-blade light rigs, solar-panel floor tiles, a glowing atom centre piece, a curved backdrop screen with the JOULE JACKPOT logo, and the ladder as a charging-battery column
- **UI:** polished broadcast-style overlay. Hexagon option plates (A–D), question banner, ladder on the right, 3 hexagon lifeline icons, timer ring. Crisp vector UI over the pixel-art 3D scene.
- **Characters:** pixel-art sprite billboards: the host (with mouth frames) and the player at the hot-seat desk
- **Camera:** scripted shots: wide, push-in on question, player close-up in suspense, crowd cutaways

### 12.2 Fake audience
- 100–300 instanced pixel sprites in tiered seating, each with a random palette
- Reaction states: idle, clap, cheer, gasp, murmur, driven by game events and layered crowd audio

### 12.3 Light shows & suspense

| Moment | Lights | Crowd | Audio |
|---|---|---|---|
| Intro | Full sweep, moving heads, strobes | Cheer + clap | Main theme |
| Question shown | Dim blue, desk spotlight | Quiet | Tier bed |
| Timer < 10 s | Red pulse on ring | Murmur | Tick speeds up |
| Locked | Plate orange, beams converge | Hush | Lock sting |
| Suspense | Heartbeat pulse, slow orbit, flicker | Hold breath | Suspense loop |
| Correct | Plate green, gold burst, sweeping beams | Cheer | Correct sting |
| Wrong | Plate red, correct flashes green, dim red | Gasp | Wrong sting |
| Double Chance miss | Red flash on one plate, lights stay tense | Gasp then murmur | Short miss sting |
| Lifeline | Colour wash per lifeline | Murmur | Lifeline sting |
| Walk away | Warm white spotlight | Applause | Walk-away sting |
| Jackpot | Confetti, pyro sprites, full rig | Standing ovation | Win fanfare |

### 12.4 Audio (ACE-Step)
Pre-generated, shipped as static files in `/public/audio`.
Cues: main theme, lobby loop, 3 tier beds, timer tick, lock sting, suspense loop, correct, wrong, miss, 3 lifeline stings, phone-a-friend bed, walk-away, win fanfare. Crowd layers (applause, cheer, gasp, murmur) are probably SFX rather than music generation.
**Check ACE-Step's license and output terms** before public use.

---

## 13. Technical Architecture (Vercel)

```
Next.js app on Vercel
 ├─ app/page.tsx              game (R3F scene, client-only, code-split)
 ├─ app/admin/*               password-gated admin + question bank
 ├─ app/api/game/*            start, question, lock, lifeline, walk-away
 ├─ app/api/admin/*           login, questions CRUD, settings, tts cache
 ├─ app/api/tts               server-side ElevenLabs proxy + cache
 ├─ public/                   audio, sprite sheets, textures (Vercel CDN)
 │
 ├─ Database: Turso (libSQL = SQLite-compatible, hosted)
 │    local dev → file:./data/joule.db   (same code, same SQL)
 │    production → Turso URL + token in Vercel env vars
 └─ Voice cache: Vercel Blob (generated ElevenLabs clips)
```

### 13.1 Why the database changed
Vercel is serverless, so **an SQLite file inside the app is lost**: the filesystem is read-only or reset between requests, and admin edits would disappear. Server memory isn't shared between requests either, so game sessions can't live there.
- **Choice: Turso (libSQL).** It's SQLite-compatible, so local dev still uses a plain `.db` file with zero setup, and production points at Turso with two env vars. It has a free tier, and the code is the same in both places.
  - Alternative: Neon Postgres from the Vercel Marketplace (more setup, different SQL dialect).
- **Voice clips:** Vercel Blob instead of a local folder.
- **Region:** put the Turso DB in the same region as the Vercel functions (e.g. Mumbai) to keep API calls fast.

### 13.2 Rules
- **Tables:** `questions`, `settings`, `sessions`, `host_lines`. Seeded by a script (`npm run db:seed`).
- **Sessions in DB:** every game action is stateless on the server. It reads the session row, validates it, writes it back.
- **Timer:** the server stores the deadline (and the pause state) and the client shows the countdown.
- **Secrets (Vercel env vars):**
  - `ADMIN_PASSWORD`, `APP_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BLOB_READ_WRITE_TOKEN`
  - The ElevenLabs key is stored encrypted in `settings` (with `APP_SECRET`) and never sent to the client.
- **Vercel limits to respect:**
  - Function time limits: generate one TTS clip per request. "Pre-generate all" runs as many small requests, not one big one.
  - Cold starts: the first API call may take ~0.5–1 s, so call `/api/game/start` while the intro plays.
- **Backups:** admin export (JSON/CSV) plus Turso's own backups.

---

## 14. Performance (target: 60 FPS)

A three.js scene can **hang or stutter** without discipline. Performance is a requirement, not polish.

### 14.1 Targets
- **Baseline device:** mid-range laptop with integrated graphics (Intel Iris Xe / AMD Radeon integrated class), Chrome or Edge, 1080p.
- **Frame rate:** **60 FPS sustained** on the baseline, at every moment including the jackpot light show.
  - **Pass/fail:** at least 99% of frames ≤ 16.7 ms, and **no frame over 33 ms** (no visible hitch) during reveals.
  - "Every single frame at 60" can't be guaranteed on any web page (the browser, other tabs and GC can steal time), so this is the measurable version.
- **Load:** game playable in ≤ 5 s on a 20 Mbps connection; ≤ 15 MB downloaded before the intro (audio streams after).
- **PC only:** no mobile target. Auto-quality (14.4) still protects weaker PCs.

### 14.2 Render budget (per frame)

| Item | Budget |
|---|---|
| Draw calls | ≤ 100 |
| Triangles | ≤ 150k |
| Real-time lights | ≤ 4 (rest faked) |
| Real-time shadows | 1 small shadow map (1024) or baked |
| Post-processing | ≤ 2 passes (bloom + pixelate), at reduced resolution |
| Texture memory | ≤ 128 MB, atlased, KTX2/Basis compressed |
| JS work in frame loop | ≤ 4 ms |

### 14.3 Techniques (mandatory)
- **Pixel-art helps:** render the 3D scene at a **low internal resolution** (e.g. 640×360) and upscale with nearest filtering. The GPU does far less work, and it *is* the art style. The DOM UI stays full resolution.
- **Audience = one draw call:** all 100–300 sprites in a single `InstancedMesh`. Animation runs in the shader using per-instance attributes (sprite frame, reaction state, time offset). JS does no per-sprite work per frame.
- **Fake the light show:** stage beams are additive cone meshes with gradient textures, not real volumetric lights. Colour changes go through emissive materials and uniforms. Only a few real lights light the stage.
- **No React in the frame loop:** animate with `useFrame` + refs and transient store updates (zustand `subscribe`), never `setState` per frame. The timer, question text and ladder are **DOM overlay**, not canvas, so they never re-render the 3D scene.
- **No allocations per frame:** reuse vectors, matrices and colours. GC pauses are a main cause of random hitches.
- **Shader warm-up:** compile every material and effect (`renderer.compile`) and upload textures **during the loading screen**. Otherwise the first reveal or the jackpot stutters while shaders compile, right where suspense matters most.
- **Preload the whole show** before the intro: textures, sprite sheets, decoded audio buffers (Web Audio). Nothing loads mid-question.
- **Code-split three.js:** the 3D scene is a client-only dynamic import (`ssr: false`). Admin pages never download three.js.
- **Voice off the critical path:** ElevenLabs requests are async and prefetched (the next host line is fetched while the current one plays). A slow response never blocks rendering.
- **Cheap lip sync:** read one `AnalyserNode` volume value per frame and swap a mouth frame (UV offset).
- **Dispose** geometries, materials and textures on unmount, so GPU memory doesn't leak across sessions.
- **Background tab:** pause the render loop when the tab is hidden; the server timer still applies.

### 14.4 Auto-quality (holds 60 FPS)
A performance monitor (e.g. drei `PerformanceMonitor`) watches frame time. When FPS stays below ~58 for 2 s, it steps quality down:
1. Bloom off
2. Internal resolution 640×360 → 480×270
3. Audience 300 → 150 → 80 sprites
4. Fewer moving beams; shadows off

It steps back up when there's headroom, and the debug overlay shows the current level.

### 14.5 Measuring
- **Debug overlay** (`?debug=1`): FPS, frame-time graph, draw calls, triangles, quality level (`r3f-perf` / stats.js).
- **Perf test run** before each milestone sign-off: a full 16-question auto-play with scripted inputs on the baseline laptop, logging frame times. It fails if 14.1 isn't met.
- A Chrome DevTools Performance profile of the jackpot sequence, the heaviest moment.

---

## 15. Edge Cases
- Refresh mid-question → resume the same question with the server deadline
- Tab in background → the server deadline still applies
- The admin edits a question while it's live → that game keeps its copy
- A tier is empty → fallback order (§6) + admin warning
- Fewer than 16 usable questions → the game won't start ("Question bank too small")
- ElevenLabs fails mid-game → bubble-only fallback, no interruption
- Player refreshes during reconfirm → selection is cancelled, timer stays paused until the question re-renders

---

## 16. Milestones
1. **M1 Foundation:** Next.js app on Vercel, libSQL schema + seed (local file / Turso), admin password gate
2. **M2 Question Bank:** CRUD, quick-tag, import/export, coverage
3. **M3 Game logic (2D):** selection rules, timer + pause/reconfirm, 3 lifelines, walk away, host lines
4. **M4 3D stage:** set, pixel host/player, instanced audience, camera shots, **perf budget + debug overlay + auto-quality from day one**
5. **M5 Show:** lights, suspense, crowd, ACE-Step audio, ElevenLabs voice + lip sync + voice picker
6. **M6 Content & polish:** 200 questions tagged, playtests, perf test run on baseline device, production deploy on Vercel

---

## 16.1 Implementation notes (v1 build)
- **Question timer starts after the host reads the question:** the client sends `begin` when the options are shown. If it never does, the server starts the timer itself after 25 s, so a modified client can't dodge it.
- **Suspense length:** 2 s at Q1 rising to 8 s at Q16. The server judges the answer immediately; the delay is presentation only.
- **Host lines** live in `src/lib/host-lines.ts`, not the `host_lines` table (the table exists for a later admin editor).
- **Voice abuse cap:** a game can request at most 150 voice clips. After the first voice failure the client switches to bubbles for the rest of that game.
- **Placeholder audio** is synthesized until ACE-Step files are added to `public/audio/`.
- **Starter content:** 200 questions (70 easy / 70 medium / 60 hard) in `scripts/sample-questions.ts` + `scripts/question-bank.json`, loaded by `npm run db:seed`.

## 17. Open Decisions
None. Turso chosen (SQLite-compatible, so there's no dialect change between dev and production and no local setup). Platform: PC browser only.

## 18. On Hold
- **Tamil language:** waiting for someone to write the Tamil text (§9)
- **Final ElevenLabs voice:** the picker is built; the choice is made later

### 16.2 Studio + UI pass (v1.1)
- Full-circle seating bowl (3 tiers, 8 aisles, step lights, LED riser strips); every audience sprite sits on an instanced chair.
- Host and contestant sit in hot-seat chairs (chairs draw without depth write, sprites on top → no clipping).
- Centre console with two desk monitors showing the live question and answer states; side jumbotrons show level and prize.
- Gaze: characters look down at their monitor while reading and at the camera while speaking. Blinking, thinking pose.
- Speech bubbles are anchored to each character's head. Lock-in, walk-away and phone prompts appear inside the host's bubble; the contestant says the chosen answer and lifeline requests.
- HUD: question panel centred on screen; chamfered plates with real borders; banked coins and ladder hide the result until the reveal.
- Extra detail: truss lamps, LED pylons, TV cameras with tally lights, drifting light dust.
