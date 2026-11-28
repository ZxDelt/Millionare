# JOULE JACKPOT — The Energy Quiz Show

A 3D quiz-show game in the browser (PC). Design: [design/gdd/GDD.md](design/gdd/GDD.md)

## Local dev
```
npm install
cp .env.example .env.local    # set ADMIN_PASSWORD and APP_SECRET
npm run db:seed               # creates data/joule.db: settings + 200 questions (idempotent)
npm run dev                   # game: http://localhost:3000   admin: /admin
npm test                      # game-rule unit tests
```

- `/?debug=1` shows FPS, frame times, draw calls and the auto-quality level.
- Keys in game: A–D pick · Y/N confirm · Q Double Chance · P Phone a Friend · I Ask the AI · Enter next.

## Admin
- `/admin`: game rules (ladder, timers, cancels, Ask-the-AI odds), ElevenLabs key + voice picker, voice cache, pre-generate voice.
- `/admin/questions`: add/edit/delete, quick-tag E/M/H, filters, import/export JSON or CSV.
  CSV columns: `text,optionA,optionB,optionC,optionD,correct(A-D),difficulty,category,explanation,status`.

## Audio
Placeholder sounds are synthesized in the browser. Drop ACE-Step renders into `public/audio/` with the names in
[public/audio/README.md](public/audio/README.md) and they replace the placeholders automatically.

## Deploy (Vercel + Turso)
1. Create a Turso DB (same region as your Vercel functions); get its URL and an auth token.
2. Vercel → Project → Settings → Environment Variables:
   `ADMIN_PASSWORD`, `APP_SECRET`, `TURSO_DATABASE_URL` (libsql://…), `TURSO_AUTH_TOKEN`,
   and `BLOB_READ_WRITE_TOKEN` (create a Vercel Blob store) if you use ElevenLabs voice.
3. Seed once against Turso: put those values in `.env.local` temporarily and run `npm run db:seed`.
4. Deploy.

A `file:` database URL is refused on Vercel because its disk isn't persistent.

## Layout
```
src/lib/game-engine.ts   pure game rules (timer, lifelines, ladder) — unit tested
src/lib/game.ts          sessions in DB, question picking (tier → untagged → nearest tier, least-used first)
src/lib/host-lines.ts    AI host dialogue
src/lib/voice.ts         ElevenLabs proxy + cache (key encrypted at rest)
src/game/director.ts     show sequencing: host lines, suspense, lights, crowd, sound
src/game/three/          3D studio (pixel render, instanced audience, fake beams, confetti)
src/game/ui/             HUD and overlays (DOM, not canvas)
scripts/                 seed + starter question bank
```
