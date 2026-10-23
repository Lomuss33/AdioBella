import { act, fireEvent, render } from "@testing-library/react";
import { vi, test, expect, afterEach } from "vitest";
import PlayingCard from "./PlayingCard";
import { CardStyleProvider } from "./CardStyleContext";

afterEach(() => vi.unstubAllGlobals());

test("uses only the selected artwork after decoding and shares it across card mounts", async () => {
  let finishDecode!: () => void;
  const images: FakeImage[] = [];
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = "";
    decode = vi.fn(() => new Promise<void>(resolve => { finishDecode = resolve; }));
    constructor() { images.push(this); }
  }
  vi.stubGlobal("Image", FakeImage);
  const card = { rank: "JACK", suit: "HEARTS", label: "JH", faceUp: true, playable: false };
  const view = <CardStyleProvider value="french"><PlayingCard card={card} /></CardStyleProvider>;
  const { container, unmount } = render(view);
  const face = container.querySelector(".playing-card-face")!;
  expect(face).toHaveTextContent("J");
  expect(face).not.toHaveClass("has-imported-art");
  await act(async () => { images[0].onload?.(); });
  expect(face).not.toHaveClass("has-imported-art");
  await act(async () => { finishDecode(); });
  expect(face).toHaveClass("has-imported-art");
  expect(face.querySelector(".playing-card-corner")).not.toBeInTheDocument();
  expect(face.querySelector(".playing-card-center")).not.toBeInTheDocument();
  expect(face.querySelector("img")).toHaveAttribute("decoding", "sync");
  expect(face.querySelector("img")).toHaveAttribute("loading", "eager");
  fireEvent.error(face.querySelector("img")!);
  expect(face.querySelector("img")).not.toBeInTheDocument();
  expect(face).not.toHaveClass("has-imported-art");
  expect(face.querySelector(".playing-card-center")).toHaveTextContent("♥");
  unmount();
  const second = render(view);
  expect(second.container.querySelector(".playing-card-face")).toHaveClass("has-imported-art");
  expect(second.container.querySelector(".playing-card-corner")).not.toBeInTheDocument();
  expect(second.container.querySelector(".playing-card-center")).not.toBeInTheDocument();
  expect(images).toHaveLength(1);
});

test("the original style remains a native face without loading imported artwork", () => {
  const image = vi.fn();
  vi.stubGlobal("Image", image);
  const { container } = render(<CardStyleProvider value="original"><PlayingCard
    card={{ rank: "ACE", suit: "CLUBS", label: "AC", faceUp: true, playable: false }} /></CardStyleProvider>);
  expect(container.querySelector(".playing-card-center")).toHaveTextContent("♣");
  expect(container.querySelector("img")).not.toBeInTheDocument();
  expect(image).not.toHaveBeenCalled();
});

test("an unavailable deck image leaves the correct rank and suit visible", async () => {
  let fail!: () => void;
  vi.stubGlobal("Image", class {
    set onerror(value: () => void) { fail = value; }
    set src(_value: string) {}
  });
  const { container } = render(<CardStyleProvider value="italian"><PlayingCard
    card={{ rank: "QUEEN", suit: "SPADES", label: "QS", faceUp: true, playable: false }} /></CardStyleProvider>);
  await act(async () => { fail(); });
  expect(container.querySelector(".playing-card-face")).not.toHaveClass("has-imported-art");
  expect(container.querySelector(".playing-card-corner")).toHaveTextContent("Q♠");
});
