// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EasyVisionBadge } from './EasyVisionBadge';

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

describe('EasyVisionBadge', () => {
  it('renders children with default tone and variant', () => {
    act(() => root.render(<EasyVisionBadge>Alta</EasyVisionBadge>));
    const el = host.querySelector('span.ev-badge')!;
    expect(el.textContent).toBe('Alta');
    expect(el.getAttribute('data-tone')).toBe('neutral');
    expect(el.getAttribute('data-variant')).toBe('pill');
  });

  it('applies tone, variant and title', () => {
    act(() =>
      root.render(
        <EasyVisionBadge
          tone="negative"
          variant="dot"
          title="Riesgo"
          className="x"
        >
          Mala
        </EasyVisionBadge>,
      ),
    );
    const el = host.querySelector('span.ev-badge')!;
    expect(el.getAttribute('data-tone')).toBe('negative');
    expect(el.getAttribute('data-variant')).toBe('dot');
    expect(el.getAttribute('title')).toBe('Riesgo');
    expect(el.classList.contains('x')).toBe(true);
  });
});
