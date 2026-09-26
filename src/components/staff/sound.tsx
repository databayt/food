"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";

import { useDictionary } from "@/components/internationalization/use-dictionary";
import { cn } from "@/lib/utils";

/**
 * New-order chime for the staff screens. A synthesized two-tone beep (Web
 * Audio, no asset). Browsers only let a page make sound after a tap, so the
 * first tap anywhere on a staff screen unlocks it; the preference ("off")
 * persists per device. Default is on — a restaurant wants to hear orders.
 */
type SoundState = "off" | "locked" | "on";

const PREF_KEY = "cb:staff-sound";
const GESTURES = ["click", "touchend", "keydown"] as const;

let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function prefOn(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

function setPref(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // private mode: the choice lasts until reload
  }
  emit();
}

function getState(): SoundState {
  if (!prefOn()) return "off";
  return ctx?.state === "running" ? "on" : "locked";
}

/** Must run inside a user gesture the first time. */
function unlock() {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return;
  if (!ctx) {
    ctx = new Ctor();
    ctx.onstatechange = emit;
  }
  if (ctx.state !== "running") void ctx.resume().then(emit, emit);
}

function onGesture() {
  if (prefOn()) unlock();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1)
    GESTURES.forEach((g) =>
      document.addEventListener(g, onGesture, { capture: true }),
    );
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0)
      GESTURES.forEach((g) =>
        document.removeEventListener(g, onGesture, { capture: true }),
      );
  };
}

/** Play the chime if sound is on and unlocked; otherwise do nothing. */
export function playChime() {
  if (!ctx || ctx.state !== "running" || !prefOn()) return;
  const start = ctx.currentTime;
  [880, 1320, 880, 1320].forEach((frequency, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    const t = start + i * 0.2;
    osc.type = "triangle";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

export function useStaffSound(): SoundState {
  return useSyncExternalStore(subscribe, getState, () => "locked");
}

/** Header control: shows whether new orders will be heard, and fixes it in one tap. */
export function SoundToggle() {
  const dict = useDictionary();
  const state = useStaffSound();

  // A tap anywhere unlocks sound; this only makes sure the listeners exist.
  useEffect(() => subscribe(() => {}), []);

  const onClick = () => {
    // Decide from what the user saw — the capture listener may already be unlocking.
    if (state === "on") {
      setPref(false);
      return;
    }
    setPref(true);
    unlock();
    window.setTimeout(playChime, 150);
  };

  const Icon = state === "on" ? Volume2 : VolumeX;
  const label =
    state === "on"
      ? dict?.staff?.soundOn
      : state === "off"
        ? dict?.staff?.soundOff
        : dict?.staff?.soundHint;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={state === "on"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        state === "on" && "bg-muted text-foreground",
        state === "off" && "bg-muted text-muted-foreground",
        state === "locked" && "animate-pulse bg-amber-100 text-amber-900",
      )}
      data-testid="sound-toggle"
      data-state={state}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
