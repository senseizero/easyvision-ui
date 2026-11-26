// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EasyVisionHint } from './EasyVisionHint';

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

const trigger = () => host.querySelector('button') as HTMLButtonElement;
const popup = () => document.querySelector('.ev-tooltip-content');
const wait = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));
// Polls instead of sleeping a fixed time: resolves as soon as the check holds.
async function until(check: () => unknown, ms = 1500) {
  for (let t = 0; t < ms && !check(); t += 10) await wait(10);
  expect(check()).toBeTruthy();
}

describe('EasyVisionHint', () => {
  it('the trigger is a button named by label', () => {
    act(() => root.render(<EasyVisionHint label="Resumen">body</EasyVisionHint>));
    expect(trigger().getAttribute('aria-label')).toBe('Resumen');
    expect(popup()).toBeNull();
  });

  it('opens on keyboard focus with title and body, Escape closes', async () => {
    act(() =>
      root.render(
        <EasyVisionHint label="Resumen" title="Resumen del documento">
          Line one{'\n'}Line two
        </EasyVisionHint>,
      ),
    );
    act(() => trigger().focus());
    await wait(50);
    expect(popup()).not.toBeNull();
    expect(popup()!.querySelector('b')!.textContent).toBe('Resumen del documento');
    expect(popup()!.textContent).toContain('Line two');
    act(() => {
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    await wait(50);
    expect(popup()).toBeNull();
  });

  it('opens on hover', async () => {
    act(() => root.render(<EasyVisionHint label="i">body text</EasyVisionHint>));
    act(() => {
      for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointermove', 'mousemove'])
        trigger().dispatchEvent(new MouseEvent(type, { bubbles: type !== 'pointerenter' && type !== 'mouseenter' }));
    });
    await until(popup);
    expect(popup()?.textContent).toContain('body text');
  });

  it('applies maxWidth to the popup', async () => {
    act(() => root.render(<EasyVisionHint label="i" maxWidth={300}>x</EasyVisionHint>));
    act(() => trigger().focus());
    await wait(50);
    expect((popup() as HTMLElement).style.maxWidth).toBe('300px');
  });

  it('a click does not reach the parent', () => {
    const onClick = vi.fn();
    act(() =>
      root.render(
        <div onClick={onClick}>
          <EasyVisionHint label="i">x</EasyVisionHint>
        </div>,
      ),
    );
    act(() => trigger().click());
    expect(onClick).not.toHaveBeenCalled();
  });
});
