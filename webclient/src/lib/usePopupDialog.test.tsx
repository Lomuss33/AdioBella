import { cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { usePopupDialog } from "./usePopupDialog";

function Popup({ lock = true }: { lock?: boolean }) {
  const ref = usePopupDialog(true, { fitToViewport: false, lockPageScroll: lock });
  return <dialog ref={ref}><button>Continue</button></dialog>;
}

beforeEach(() => {
  document.body.style.overflow = "auto";
  document.body.style.paddingInlineEnd = "12px";
  document.documentElement.style.scrollbarGutter = "stable";
  vi.spyOn(document.documentElement, "getBoundingClientRect").mockImplementation(() =>
    new DOMRect(0, 0, window.innerWidth - (document.documentElement.style.scrollbarGutter === "auto" ? 0 : 20), 800));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.style.overflow = "";
  document.body.style.paddingInlineEnd = "";
  document.documentElement.style.scrollbarGutter = "";
});

test("releases the root gutter without shifting the page and restores the original styles", () => {
  const { unmount } = render(<StrictMode><Popup /></StrictMode>);
  expect(document.documentElement.style.scrollbarGutter).toBe("auto");
  expect(document.body.style.overflow).toBe("hidden");
  expect(document.body.style.paddingInlineEnd).toBe("32px");
  unmount();
  expect(document.documentElement.style.scrollbarGutter).toBe("stable");
  expect(document.body.style.overflow).toBe("auto");
  expect(document.body.style.paddingInlineEnd).toBe("12px");
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
