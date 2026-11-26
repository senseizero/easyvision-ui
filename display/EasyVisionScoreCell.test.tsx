// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
 import { EasyVisionScoreCell } from './EasyVisionScoreCell';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const bands = [
  { min: 0.8, tone: 'negative' as const },
  { min: 0.65, tone: 'negative' as const },
  { min: 0.4, tone: 'warn' as const },
  { min: 0, tone: 'neutral' as const },
];
const render = (el: React.ReactElement) => {
  act(() => root.render(el));
  return host.querySelector('.ev-score')!;
};

describe('EasyVisionScoreCell', () => {
  it('formats and tones by band', () => {
    const el = render(<EasyVisionScoreCell value={0.787} bands={bands} />);
    expect(el.textContent).toBe('78.7 %');
    expect(el.getAttribute('data-tone')).toBe('negative');
  });
  it('picks warn for 0.5', () => {
    expect(render(<EasyVisionScoreCell value={0.5} bands={bands} />).getAttribute('data-tone')).toBe('warn');
  });
  it('no bands, no tone', () => {
    expect(render(<EasyVisionScoreCell value={0.5} />).hasAttribute('data-tone')).toBe(false);
  });
  it('null is a dash', () => {
    expect(render(<EasyVisionScoreCell value={null} bands={bands} />).textContent).toBe('–');
  });
});
