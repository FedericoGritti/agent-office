// What this browser remembers between visits, in localStorage: your profile, your settings, the floor
// you were last on and the spot you were standing in. Every read and write shrugs off blocked storage.

import { randomLook, sanitizeLook, type Look } from '../../shared/avatar';
import { randomPalette, readPalette, type Palette } from '../palette';

export interface Profile {
  name: string;
  color: string;
  look: Look;
}

const PROFILE_KEY = 'agent-office.profile';
export const AVATAR_COLORS = ['#ff8a5b', '#4f86f7', '#06d6a0', '#ef476f', '#ffd166', '#9d4edd', '#00b4d8', '#f77f00'];

/** Your saved profile. `look` is missing if you joined before there was a character select screen. */
export function loadProfile(): (Omit<Profile, 'look'> & { look?: Look }) | null {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null');
    if (p && typeof p.name === 'string' && typeof p.color === 'string') {
      return { name: p.name, color: p.color, look: p.look ? sanitizeLook(p.look, randomLook()) : undefined };
    }
  } catch {
    // storage blocked
  }
  return null;
}

/** Without a look, the 3D office still has you pick a character (the 2D view saves only a name). */
export function saveProfile(p: Omit<Profile, 'look'> & { look?: Look }) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    // storage blocked
  }
}

export type ViewMode = 'first' | 'third';

/** The panels you can show or hide on screen, from the ☰ menu. */
export type HudPanel = 'workers' | 'people' | 'spend' | 'limits' | 'chat' | 'floor';
/** Out of the way by default: only the chat shows until you turn the rest on. */
export const HUD_DEFAULTS: Record<HudPanel, boolean> = { workers: false, people: false, spend: false, limits: false, chat: true, floor: false };

/** How the office rings when a worker needs you: not at all, once, or again and again until someone's at its terminal. */
export const NEEDS_YOU_SOUNDS = ['off', 'once', 'remind'] as const;
export type NeedsYouSound = (typeof NEEDS_YOU_SOUNDS)[number];

/** How the light on everything is shaded: the office's flat toon banding, or a smooth run (see world/toon.ts). */
export const SHADINGS = ['toon', 'smooth'] as const;
export type Shading = (typeof SHADINGS)[number];

export interface Settings {
  view: ViewMode;
  /** Your own hands, drawn in front of the camera in first person. Off, the view is the office and your body below you, nothing else. */
  hands: boolean;
  /** Office sounds, 0–1. */
  volume: number;
  muted: boolean;
  /** The lounge jukebox, 0–1, apart from the office sounds. */
  music: number;
  musicMuted: boolean;
  /** The swish of a page turning as you read at the bookshelf. */
  pageTurns: boolean;
  /** Voice chat starts muted and V is held down to talk, instead of an open mic. */
  pushToTalk: boolean;
  /** Desktop notifications when a worker needs input or finishes while you're in another tab (once the browser allows them). */
  notify: boolean;
  /** The alarm when a worker stops to ask you something: not at all, once, or again every half minute until someone's at its terminal. */
  needsYouSound: NeedsYouSound;
  /** Which panels show on screen. */
  hud: Record<HudPanel, boolean>;
  /** The ☰ menu's actions you pinned to the top bar, by id. */
  pins: string[];
  /** The ink line round everything: the office's own look, and a second pass over the whole scene (see core/graphics.ts). */
  outlines: boolean;
  /** The sun's shadows, drawn into a map on every frame. */
  shadows: boolean;
  /** How many pixels the office draws per pixel of the screen: the most the device offers, up to this. */
  resolution: number;
  /** Keep measuring what a frame costs after the Settings window is closed, and show it on screen: the only
   * way to see a stutter in the place it happens (see core/perf.ts). */
  measure: boolean;
  /** Toon keeps the office's flat bands; smooth shades it like an ordinary lit room (see world/toon.ts). */
  shading: Shading;
  /** The palette the room and everything in it is painted from, or null for each floor's own (see palette.ts). */
  palette: Palette | null;
  /** A scheme of the palette at random, and a different one each time the office opens, instead of `palette`. */
  paletteRandom: boolean;
}

const SETTINGS_KEY = 'agent-office.settings';
const FLOOR_KEY = 'agent-office.floor';

/** The floor you were last on, to come back to it after a reload. */
export function lastFloor(): string | null {
  try {
    return localStorage.getItem(FLOOR_KEY);
  } catch {
    return null;
  }
}

export function rememberFloor(id: string | null) {
  try {
    if (id) localStorage.setItem(FLOOR_KEY, id);
  } catch {
    // storage blocked
  }
}

const SPOT_KEY = 'agent-office.spot';

/** Where you were standing, on which floor (or the roof), to be back there when you come back in. */
export interface Spot {
  floor: string;
  /** What that floor was called, to say so if it's gone by then. */
  name: string;
  /** The building's map then (see shared/maps): a spot on another map is nowhere on this one. */
  map?: string;
  /** Sitting on its throne. */
  throne?: boolean;
  x: number;
  y: number;
  z: number;
  facing: number;
}

/** The spot you were last in, if this browser has one. */
export function lastSpot(): Spot | null {
  try {
    const s = JSON.parse(localStorage.getItem(SPOT_KEY) ?? 'null');
    const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
    if (s && typeof s.floor === 'string' && s.floor && finite(s.x) && finite(s.y) && finite(s.z) && finite(s.facing)) {
      return { floor: s.floor, name: typeof s.name === 'string' ? s.name : '', ...(typeof s.map === 'string' ? { map: s.map } : {}), ...(s.throne === true ? { throne: true } : {}), x: s.x, y: s.y, z: s.z, facing: s.facing };
    }
  } catch {
    // storage blocked
  }
  return null;
}

export function rememberSpot(s: Spot) {
  try {
    localStorage.setItem(SPOT_KEY, JSON.stringify(s));
  } catch {
    // storage blocked
  }
}

export function loadSettings(): Settings {
  const s: Settings = { view: 'first', hands: false, volume: 0.7, muted: false, music: 0.5, musicMuted: false, pageTurns: true, pushToTalk: false, notify: true, needsYouSound: 'once', hud: { ...HUD_DEFAULTS }, pins: [], outlines: true, shadows: true, resolution: 2, measure: false, shading: 'toon', palette: null, paletteRandom: false };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
    if (saved?.view === 'first' || saved?.view === 'third') s.view = saved.view;
    if (typeof saved?.hands === 'boolean') s.hands = saved.hands;
    if (typeof saved?.volume === 'number' && Number.isFinite(saved.volume)) s.volume = Math.max(0, Math.min(1, saved.volume));
    if (typeof saved?.muted === 'boolean') s.muted = saved.muted;
    if (typeof saved?.music === 'number' && Number.isFinite(saved.music)) s.music = Math.max(0, Math.min(1, saved.music));
    if (typeof saved?.musicMuted === 'boolean') s.musicMuted = saved.musicMuted;
    if (typeof saved?.pageTurns === 'boolean') s.pageTurns = saved.pageTurns;
    if (typeof saved?.pushToTalk === 'boolean') s.pushToTalk = saved.pushToTalk;
    if (typeof saved?.notify === 'boolean') s.notify = saved.notify;
    if (NEEDS_YOU_SOUNDS.includes(saved?.needsYouSound)) s.needsYouSound = saved.needsYouSound;
    for (const k of Object.keys(s.hud) as HudPanel[]) if (typeof saved?.hud?.[k] === 'boolean') s.hud[k] = saved.hud[k];
    if (Array.isArray(saved?.pins)) s.pins = saved.pins.filter((p: unknown): p is string => typeof p === 'string').slice(0, 30);
    if (typeof saved?.outlines === 'boolean') s.outlines = saved.outlines;
    if (typeof saved?.shadows === 'boolean') s.shadows = saved.shadows;
    if (typeof saved?.measure === 'boolean') s.measure = saved.measure;
    // A resolution nobody offers (a file edited by hand) is left at the sharpest.
    if (typeof saved?.resolution === 'number' && saved.resolution >= 0.5 && saved.resolution <= 2) s.resolution = saved.resolution;
    if (SHADINGS.includes(saved?.shading)) s.shading = saved.shading;
    // A stored palette is a file someone can edit: the right colours, or none of it (see palette.ts).
    s.palette = readPalette(saved?.palette);
    // A scheme at random, and never the same one twice running: what the room is painted with this
    // time, chosen as the office opens (see randomPalette).
    s.paletteRandom = saved?.paletteRandom === true;
    if (s.paletteRandom) s.palette = randomPalette(s.palette?.name);
  } catch {
    // storage blocked
  }
  return s;
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // storage blocked
  }
}
