// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EasyVisionSparkline } from './EasyVisionSparkline';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = (el: React.ReactElement) => {
  act(() => root.render(el));
  return host.querySelector('svg')!;
};
const noNaN = (svg: Element) =>
  [svg, ...svg.querySelectorAll('*')].forEach((e) =>
    Array.from(e.attributes).forEach((a) =>
      expect(a.value).not.toContain('NaN'),
    ),
  );

describe('EasyVisionSparkline', () => {
  it('draws a polyline with one pair per point', () => {
    const svg = render(<EasyVisionSparkline values={[1, 3, 2]} />);
    const pts = svg
      .querySelector('polyline')!
      .getAttribute('points')!
      .trim()
      .split(/\s+/);
    expect(pts).toHaveLength(3);
    noNaN(svg);
  });
  it('handles empty and single value', () => {
    noNaN(render(<EasyVisionSparkline values={[]} />));
    noNaN(render(<EasyVisionSparkline values={[5]} />));
  });
  it('flat series sits at mid-height', () => {
    const svg = render(<EasyVisionSparkline values={[4, 4, 4]} height={20} />);
    const ys = svg
      .querySelector('polyline')!
      .getAttribute('points')!
      .trim()
      .split(/\s+/)
      .map((p) => p.split(',')[1]);
    expect(new Set(ys)).toEqual(new Set(['10']));
  });
  it('aria-label or aria-hidden', () => {
    expect(
      render(
        <EasyVisionSparkline values={[1, 2]} ariaLabel="tendencia" />,
      ).getAttribute('aria-label'),
    ).toBe('tendencia');
    expect(
      render(<EasyVisionSparkline values={[1, 2]} />).getAttribute(
        'aria-hidden',
      ),
    ).toBe('true');
  });
  it('stroke and dot carry a fallback', () => {
    const svg = render(<EasyVisionSparkline values={[1, 2]} tone="negative" />);
    expect(svg.querySelector('polyline')!.getAttribute('stroke')).toBe(
      'var(--ev-negative, #DC2626)',
    );
    expect(svg.querySelector('circle')!.getAttribute('fill')).toBe(
      'var(--ev-negative, #DC2626)',
    );
  });
  it('stroke follows tone, neutral by default', () => {
    expect(
      render(<EasyVisionSparkline values={[1, 2]} tone="warn" />)
        .querySelector('polyline')!
        .getAttribute('stroke'),
    ).toContain('--ev-warn');
    expect(
      render(<EasyVisionSparkline values={[1, 2]} />)
        .querySelector('polyline')!
        .getAttribute('stroke'),
    ).toContain('--ev-neutral');
  });
});
