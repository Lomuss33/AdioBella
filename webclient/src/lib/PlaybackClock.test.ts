import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PlaybackClock } from "./PlaybackClock";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("changes speed without restarting elapsed time or firing a callback twice", () => {
  const clock = new PlaybackClock(), finished = vi.fn();
  clock.schedule(1000, finished);
  vi.advanceTimersByTime(300);
  clock.setRate(2);
  vi.advanceTimersByTime(349);
  expect(finished).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(finished).toHaveBeenCalledOnce();
  clock.setRate(1);
  vi.advanceTimersByTime(1000);
  expect(finished).toHaveBeenCalledOnce();
});

test("slows the remaining phases and preserves callbacks that schedule new phases", () => {
  const clock = new PlaybackClock(2), phases: string[] = [];
  clock.schedule(400, () => {
    phases.push("landing");
    clock.schedule(100, () => phases.push("rest"));
  });
  vi.advanceTimersByTime(100);
  clock.setRate(1);
  vi.advanceTimersByTime(199);
  expect(phases).toEqual([]);
  vi.advanceTimersByTime(1);
  expect(phases).toEqual(["landing"]);
  vi.advanceTimersByTime(100);
  expect(phases).toEqual(["landing", "rest"]);
});

test("clearing a skipped sequence cancels every pending phase, including after speed changes", () => {
  const clock = new PlaybackClock(), callback = vi.fn();
  clock.schedule(200, callback);
  clock.schedule(800, callback);
  vi.advanceTimersByTime(100);
  clock.setRate(2);
  clock.clear();
  clock.setRate(1);
  vi.advanceTimersByTime(2000);
  expect(callback).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

test("finishes one wait exactly once while preserving other deadlines", () => {
  const clock = new PlaybackClock(), selection = vi.fn(), other = vi.fn();
  const finish = clock.schedule(140, selection);
  clock.schedule(400, other);
  vi.advanceTimersByTime(20);
  finish();
  finish();
  expect(selection).toHaveBeenCalledOnce();
  expect(other).not.toHaveBeenCalled();
  clock.setRate(2);
  vi.advanceTimersByTime(189);
  expect(other).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(other).toHaveBeenCalledOnce();
  expect(selection).toHaveBeenCalledOnce();
});

test("finishing a canceled wait cannot revive its callback", () => {
  const clock = new PlaybackClock(), callback = vi.fn();
  const finish = clock.schedule(140, callback);
  clock.clear();
  finish();
  vi.advanceTimersByTime(500);
  expect(callback).not.toHaveBeenCalled();
});
