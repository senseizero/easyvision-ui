// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EasyVisionDelta } from "./EasyVisionDelta";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = (el: React.ReactElement) => {
  act(() => root.render(el));
  return host.querySelector(".ev-delta")!;
};

describe("EasyVisionDelta", () => {
  it("up is positive by default", () => {
    const el = render(<EasyVisionDelta value={2} />);
    expect(el.textContent).toBe("▲ 2");
    expect(el.getAttribute("data-tone")).toBe("positive");
  });
  it("down with goodWhen up is negative", () => {
    const el = render(<EasyVisionDelta value={-17} goodWhen="up" />);
    expect(el.textContent).toBe("▼ 17");
    expect(el.getAttribute("data-tone")).toBe("negative");
  });
  it("down with goodWhen down is positive", () => {
    const el = render(<EasyVisionDelta value={-3} goodWhen="down" />);
    expect(el.getAttribute("data-tone")).toBe("positive");
  });
  it("zero is a neutral dash", () => {
    const el = render(<EasyVisionDelta value={0} />);
    expect(el.textContent).toBe("–");
    expect(el.getAttribute("data-tone")).toBe("neutral");
  });
  it("non-finite is a neutral dash", () => {
    for (const v of [NaN, Infinity, -Infinity]) {
      const el = render(<EasyVisionDelta value={v} />);
      expect(el.textContent).toBe("–");
      expect(el.getAttribute("data-tone")).toBe("neutral");
    }
  });
  it("applies format", () => {
    const el = render(<EasyVisionDelta value={5} format={(n) => n + " %"} />);
    expect(el.textContent).toBe("▲ 5 %");
  });
});
