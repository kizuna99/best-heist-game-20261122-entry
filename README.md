# Midnight Vault — a one-night heist game

[![make.fun bounty](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/kizuna99/best-heist-game-20261122-entry/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/kizuna99/best-heist-game-20261122-entry/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

**Midnight Vault** is an original top-down stealth heist game that plays in a
desktop browser from static files — no build step, no network request. One
night, three floors: the Marlowe Gallery, the Counting House offices and the
Aurora Vault. Slip past patrolling guards and sweeping cameras, read their
vision cones before you move, and decide what the loot is worth: every extra
painting is money in the bag and seconds on the alarm clock.

## How to play

- **WASD / arrow keys** — move. **Shift** — sneak (slower, harder to spot).
- **E** — grab loot, pick a lock, cut a camera at its wall panel.
- **Mouse click** — toss a coin: guards go and look where it lands.
- **F** — fire an EMP charge: every camera goes dark for eight seconds.
- **M** — mute. **R** — restart the floor after a bust.

Being seen fills the **alarm meter**. A full meter, or a guard's hand on your
collar, ends the night early. Take the floor's star piece, reach the getaway
van, and the floor's haul is banked. Finish all three floors for the final
score: loot banked, time taken, and how often you were seen decide whether
you leave as a Ghost or as a headline.

## Layout

- `main.ts` — the hand-in program (Node 22, standard library only): copies
  `game/` and `screenshots/` to the output directory and writes
  `dossier.json` with the vendored make.fun library.
- `game/` — the game itself: `index.html` plus ES modules under `game/src/`,
  one job each (floors, vision, guards, cameras, alarm, thief, audio, render).
- `screenshots/` — real renders of the game, staged by `game/src/shots.js`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

Play it locally with `node serve.ts`, then open http://localhost:8080.

## License

MIT — see `LICENSE`.
