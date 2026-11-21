# Dustline — Open-World Crime Game

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/ulwan66/dustline/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/ulwan66/dustline/reward.svg)](https://make.fun/bounty/gta6-01)

**Dustline** is an open-world crime game in the spirit of GTA 6, built for the
[Make GTA 6 bounty](https://make.fun/bounty/gta6-01). You are Mara Quinn, a
getaway driver back in the desert city of Dustline after five years away.
Five jobs. One way out.

## Play

Serve `game/` with any static server — `node serve.ts`, then open
http://localhost:8080 — and play in desktop Chrome. No build step, no network
requests, no downloads: every script, image and sound is a file under `game/`,
and all sound is synthesized live with WebAudio.

| Key | Action |
| --- | ------ |
| WASD / arrows | Walk, run (Shift), drive |
| E | Enter / steal a car, get out |
| F | Punch |
| Click / G | Shoot the pistol toward the cursor |
| Space | Handbrake |
| P / Esc | Pause (progress saves) |
| M | Mute |

## The city

Dustline is a 3840×3840 desert city: eight roads each way, downtown neon in
the middle, sand, palms and motels outside it. Traffic follows the lanes and
stops at red lights; pedestrians walk the sidewalks and flee from gunfire and
sirens. The sun hangs low in a golden afternoon and slides toward dusk as you
play — headlights and neon take over after dark.

## Wanted

Steal a car, hit a pedestrian or shoot at the police and the stars go up
(1–5). Patrol cars spawn at the edge of the map, chase you along the roads,
ram your car, and at four stars set roadblocks. Stay out of sight and the
heat cools down; get caught on foot and you are busted, fined $200 and
dropped at the clinic.

## Missions

1. **Welcome Back** — get the car at Dustline Motors and drive to the meet.
2. **Heat on Your Tail** — reach the Rooftop Motel with the cops still chasing.
3. **The Package** — cross town in 90 seconds.
4. **Heist Prep** — collect 3 stashes while the Vipers gang shoots back.
5. **The Last Run** — four stars, one last drive to the Old Mill safehouse.

Finishing a mission pays cash; progress, money and position save to
localStorage automatically.

## Tips

- The fastest car in Dustline is the red sportscar — worth stealing even with
  the heat it brings. Brake before a corner: the streets are narrow and the
  buildings do not move.
- Cops lose you faster if you break line of sight and stay quiet for a few
  seconds. A wanted level of 1 fades on its own if nobody sees you.
- Health regenerates after a few seconds out of trouble. Ammo and health
  pickups are worth the detour before the Heist Prep job.

## Screenshots

The three screenshots in `screenshots/` are real renders of this game in
Chrome, staged deterministically with `?shot=start|play|end&seed=1` — the
title screen, a mid-chase frame (wanted 3, mission 2 live), and the
mission-complete screen.

## Structure

Vanilla Canvas 2D, one clear job per file under `game/src/`:

- `main.js` — boot, the fixed-step loop, screens
- `world.js` — city generation, the player on foot, pickups, particles
- `config.js` — tuning, palette, mission catalogue, road helpers
- `traffic.js` — civilian cars: lanes, lights, car-ahead braking
- `pedestrians.js` — sidewalk walkers who flee danger
- `vehicles.js` — stealing, driving physics, road-grid routing
- `police.js` — the wanted system, chases, roadblocks, busts
- `missions.js` — the five story jobs
- `combat.js` — fists, pistol, gang members
- `audio.js` — synthesized engine, sirens, gunshots, UI
- `render.js` — the city, the cars, the light, the screens
- `hud.js` — money, health, wanted stars, minimap, mission banner
- `save.js` — localStorage save / load
- `shots.js` — deterministic `?shot=start|play|end` scenes

## License

MIT — see `LICENSE`.
