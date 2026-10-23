import { act, renderHook } from "@testing-library/react";
import type { CardStyle } from "./preferences";

const images: ControlledImage[] = [];
class ControlledImage {
  src = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  finishDecode!: () => void;
  decode = vi.fn(() => new Promise<void>(resolve => { this.finishDecode = resolve; }));
  constructor() { images.push(this); }
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  images.length = 0;
  vi.stubGlobal("Image", ControlledImage);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test("a prepared deck waits for all 32 faces and the back to decode and is shared", async () => {
  const { preloadDeckArtwork } = await import("./cardArtwork");
  const ready = preloadDeckArtwork("french");
  expect(preloadDeckArtwork("french")).toBe(ready);
  expect(images).toHaveLength(33);
  let settled = false;
  void ready.then(() => { settled = true; });
  images.forEach(image => image.onload?.());
  await act(async () => { images.slice(0, -1).forEach(image => image.finishDecode()); });
  expect(settled).toBe(false);
  await act(async () => { images.at(-1)!.finishDecode(); await ready; });
  expect(settled).toBe(true);
  await preloadDeckArtwork("french");
  expect(images).toHaveLength(33);
});

test("deck changes retain the painted deck and ignore an outdated preparation", async () => {
  const { usePreparedCardStyle } = await import("./cardArtwork");
  const { result, rerender } = renderHook(({ style }) => usePreparedCardStyle(style), {
    initialProps: { style: "original" as CardStyle }
  });
  rerender({ style: "french" });
  const french = [...images];
  expect(result.current).toBe("original");
  rerender({ style: "german" });
  const german = images.filter(image => !french.includes(image));
  await act(async () => { french.forEach(image => { image.onload?.(); image.finishDecode(); }); });
  expect(result.current).toBe("original");
  await act(async () => { german.forEach(image => { image.onload?.(); image.finishDecode(); }); });
  expect(result.current).toBe("german");
  rerender({ style: "italian" });
  expect(result.current).toBe("german");
  await act(async () => {
    images.filter(image => !french.includes(image) && !german.includes(image))
      .forEach(image => { image.onload?.(); image.finishDecode(); });
  });
  expect(result.current).toBe("italian");
});

test("failed artwork settles preparation so a real missing file can use its fallback", async () => {
  const { preloadDeckArtwork } = await import("./cardArtwork");
  const ready = preloadDeckArtwork("modern");
  images[0].onerror?.();
  await act(async () => {
    images.slice(1).forEach(image => { image.onload?.(); image.finishDecode(); });
    await ready;
  });
  expect(images).toHaveLength(33);
});

test("a stalled image has a bounded wait and a late callback cannot undo failure", async () => {
  const { loadCardArtwork } = await import("./cardArtwork");
  const ready = loadCardArtwork("/stalled-card.svg");
  await vi.advanceTimersByTimeAsync(12000);
  expect(await ready).toBe(false);
  images[0].onload?.();
  images[0].finishDecode();
  expect(await loadCardArtwork("/stalled-card.svg")).toBe(false);
  expect(images).toHaveLength(1);
});

test("a loaded image remains usable when a background renderer defers decoding", async () => {
  const { loadCardArtwork } = await import("./cardArtwork");
  const ready = loadCardArtwork("/loaded-card.png");
  Object.assign(images[0], { complete: true, naturalWidth: 275 });
  images[0].onload?.();
  await vi.advanceTimersByTimeAsync(12000);
  expect(await ready).toBe(true);
});
