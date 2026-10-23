import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { usePopupDialog } from "./usePopupDialog";

function Popup({ lock = true, id = "popup", fit = false }: { lock?: boolean; id?: string; fit?: boolean }) {
  const ref = usePopupDialog(true, { fitToViewport: fit, lockPageScroll: lock });
  return <dialog ref={ref} aria-label={id}><button>{id}</button></dialog>;
}

beforeEach(() => {
  document.body.style.overflow = "auto";
  document.body.style.paddingInlineEnd = "12px";
  document.documentElement.style.scrollbarGutter = "stable";
  document.documentElement.style.overflow = "visible";
  vi.spyOn(document.documentElement, "getBoundingClientRect").mockImplementation(() =>
    new DOMRect(0, 0, window.innerWidth - (document.documentElement.style.scrollbarGutter === "auto" ? 0 : 20), 800));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.style.overflow = "";
  document.body.style.paddingInlineEnd = "";
  document.documentElement.style.scrollbarGutter = "";
  document.documentElement.style.overflow = "";
});

test("releases the root gutter without shifting the page and restores the original styles", () => {
  const { unmount } = render(<StrictMode><Popup /></StrictMode>);
  expect(document.documentElement.style.scrollbarGutter).toBe("auto");
  expect(document.body.style.overflow).toBe("hidden");
  expect(document.documentElement.style.overflow).toBe("hidden");
  expect(document.body.style.paddingInlineEnd).toBe("32px");
  unmount();
  expect(document.documentElement.style.scrollbarGutter).toBe("stable");
  expect(document.body.style.overflow).toBe("auto");
  expect(document.body.style.paddingInlineEnd).toBe("12px");
  expect(document.documentElement.style.overflow).toBe("visible");
});

test("keeps a nested popup locked if its parent closes first and restores only after the last close", () => {
  const { rerender, unmount } = render(<><Popup key="base" id="base" /><Popup key="upper" id="upper" /></>);
  rerender(<><Popup key="upper" id="upper" /></>);
  expect(document.body.style.overflow).toBe("hidden");
  expect(document.documentElement.style.overflow).toBe("hidden");
  expect(document.body.style.paddingInlineEnd).toBe("32px");
  unmount();
  expect(document.body.style.overflow).toBe("auto");
  expect(document.documentElement.style.overflow).toBe("visible");
  expect(document.documentElement.style.scrollbarGutter).toBe("stable");
  expect(document.body.style.paddingInlineEnd).toBe("12px");
});

test("moves focus into overlays and restores their original trigger after out-of-order closes", () => {
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const { rerender, unmount } = render(<><Popup key="base" id="base" /></>);
  expect(screen.getByRole("button", { name: "base" })).toHaveFocus();
  rerender(<><Popup key="base" id="base" /><Popup key="upper" id="upper" /></>);
  expect(screen.getByRole("button", { name: "upper" })).toHaveFocus();
  rerender(<><Popup key="upper" id="upper" /></>);
  expect(screen.getByRole("button", { name: "upper" })).toHaveFocus();
  unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});

test("does not steal focus or trap Tab for inline table choices", () => {
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const { unmount } = render(<Popup lock={false} />);
  expect(trigger).toHaveFocus();
  const tab = createEvent.keyDown(screen.getByRole("button", { name: "popup" }), { key: "Tab", cancelable: true });
  fireEvent(screen.getByRole("button", { name: "popup" }), tab);
  expect(tab.defaultPrevented).toBe(false);
  unmount();
  trigger.remove();
});

test("isolates only the top overlay's app background and restores existing inert states", () => {
  const { rerender, unmount } = render(<main className="app-shell"><section data-testid="background"><button>Table</button></section>
    <Popup key="base" id="base" /></main>);
  const background = screen.getByTestId("background");
  expect(background.inert).toBe(true);
  rerender(<main className="app-shell"><section data-testid="background"><button>Table</button></section>
    <Popup key="base" id="base" /><Popup key="upper" id="upper" /></main>);
  const base = screen.getByText("base").closest("dialog")!;
  expect(base.inert).toBe(true);
  expect(Boolean(screen.getByText("upper").closest("dialog")!.inert)).toBe(false);
  rerender(<main className="app-shell"><section data-testid="background"><button>Table</button></section>
    <Popup key="base" id="base" /></main>);
  expect(base.inert).toBe(false);
  expect(background.inert).toBe(true);
  unmount();
  expect(background.inert).toBe(false);
});

test("fits keyboard viewport changes without fighting native pinch zoom", () => {
  const viewport = new EventTarget();
  Object.assign(viewport, { height: 400, offsetTop: 30, scale: 1 });
  vi.stubGlobal("visualViewport", viewport);
  try {
    const { unmount } = render(<Popup fit />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.style.height).toBe("400px");
    expect(dialog.style.top).toBe("30px");
    Object.assign(viewport, { height: 250, offsetTop: 50 });
    viewport.dispatchEvent(new Event("resize"));
    expect(dialog.style.height).toBe("250px");
    expect(dialog.style.top).toBe("50px");
    Object.assign(viewport, { height: 125, offsetTop: 100, scale: 2 });
    viewport.dispatchEvent(new Event("resize"));
    expect(dialog.style.height).toBe("250px");
    expect(dialog.style.top).toBe("50px");
    unmount();
  } finally { vi.unstubAllGlobals(); }
});

test("also isolates the app when declaration details are portaled under body", () => {
  const app = document.createElement("main");
  app.className = "app-shell";
  document.body.append(app);
  const { unmount } = render(<Popup />);
  expect(app.inert).toBe(true);
  unmount();
  expect(app.inert).toBe(false);
  app.remove();
});

test("keeps the table's scrollbar and padding intact for inline choices", () => {
  const { unmount } = render(<Popup lock={false} />);
  expect(document.documentElement.style.scrollbarGutter).toBe("stable");
  expect(document.body.style.overflow).toBe("auto");
  expect(document.body.style.paddingInlineEnd).toBe("12px");
  unmount();
  expect(document.body.style.paddingInlineEnd).toBe("12px");
});

test("does not add the gutter twice when another popup opens and closes above it", () => {
  const { rerender, unmount } = render(<><Popup key="base" /></>);
  rerender(<><Popup key="base" /><Popup key="nested" /></>);
  expect(document.body.style.paddingInlineEnd).toBe("32px");
  rerender(<><Popup key="base" /></>);
  expect(document.body.style.paddingInlineEnd).toBe("32px");
  expect(document.body.style.overflow).toBe("hidden");
  expect(document.documentElement.style.scrollbarGutter).toBe("auto");
  unmount();
  expect(document.body.style.paddingInlineEnd).toBe("12px");
  expect(document.documentElement.style.scrollbarGutter).toBe("stable");
});
