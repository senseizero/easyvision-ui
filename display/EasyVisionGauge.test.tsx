// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EasyVisionGauge } from "./EasyVisionGauge";

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
  return host.querySelector(".ev-gauge")!;
};
const needleX = (el: Element) =>
  Number(el.querySelector("line")!.getAttribute("x2"));

describe("EasyVisionGauge", () => {
  it("needle points left for 0, right for 1, up for 0.5", () => {
    expect(needleX(render(<EasyVisionGauge value={0} />))).toBeLessThan(20);
    expect(needleX(render(<EasyVisionGauge value={1} />))).toBeGreaterThan(20);
    expect(needleX(render(<EasyVisionGauge value={0.5} />))).toBeCloseTo(20, 5);
  });
  it("clamps out-of-range values", () => {
    expect(needleX(render(<EasyVisionGauge value={7} />))).toBeCloseTo(
      needleX(render(<EasyVisionGauge value={1} />)),
      5,
    );
    expect(needleX(render(<EasyVisionGauge value={-3} />))).toBeCloseTo(
      needleX(render(<EasyVisionGauge value={0} />)),
      5,
    );
  });
  it("null, undefined and NaN draw no needle and show a dash", () => {
    for (const v of [null, undefined, NaN, Infinity]) {
      const el = render(<EasyVisionGauge value={v} />);
      expect(el.querySelector("line")).toBeNull();
      expect(el.textContent).toBe("–");
    }
  });
  it("renders label, tone and title", () => {
    const el = render(
      <EasyVisionGauge
        value={0.75}
        label="Alto"
        tone="negative"
        title="Score"
      />,
    );
    expect(el.textContent).toBe("Alto");
    expect(el.getAttribute("data-tone")).toBe("negative");
    expect(el.getAttribute("title")).toBe("Score");
  });
  it("draws four segments with token fallbacks, svg aria-hidden", () => {
    const svg = render(<EasyVisionGauge value={0.5} />).querySelector("svg")!;
    const fills = [...svg.querySelectorAll("path")].map((p) =>
      p.getAttribute("fill"),
    );
    expect(fills).toEqual([
      "var(--ev-gauge-1, #16a34a)",
      "var(--ev-gauge-2, #EAB308)",
      "var(--ev-gauge-3, #dc2626)",
      "var(--ev-gauge-4, #991b1b)",
    ]);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });
  it("size is the width, height is 0.6 of it", () => {
    const svg = render(<EasyVisionGauge value={0.5} size={80} />).querySelector(
      "svg",
    )!;
    expect(svg.getAttribute("width")).toBe("80");
    expect(svg.getAttribute("height")).toBe("48");
  });
});
