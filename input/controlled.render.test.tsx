// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EasyVisionInput } from './EasyVisionInput';
import { EasyVisionSelector } from '../selector/EasyVisionSelector';
import { easyVisionRegistry } from '../store/registry';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  easyVisionRegistry.setState({ slices: {} } as never);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const flush = (ms = 0) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const type = (input: HTMLInputElement, text: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

describe('EasyVisionInput, controlled', () => {
  it('shows the value it is given, reports each keystroke at once, and passes native props', async () => {
    const seen: string[] = [];
    function Form() {
      const [name, setName] = useState('Ana');
      return (
        <>
          <EasyVisionInput
            id="name"
            value={name}
            onChange={(v) => {
              seen.push(v);
              setName(v.toUpperCase());
            }}
            inputProps={{ id: 'name-input', name: 'name', required: true, 'aria-describedby': 'hint' }}
          />
          <button type="button" onClick={() => setName('')}>reset</button>
        </>
      );
    }
    act(() => root.render(<Form />));
    await flush();
    const input = document.getElementById('name-input') as HTMLInputElement;
    expect(input.value).toBe('Ana');
    expect(input.name).toBe('name');
    expect(input.required).toBe(true);
    expect(input.getAttribute('aria-describedby')).toBe('hint');

    await type(input, 'Anab');
    expect(seen).toEqual(['Anab']); // at once, no debounce
    expect(input.value).toBe('ANAB'); // what the form decided

    act(() => (document.querySelector('button')! as HTMLButtonElement).click());
    await flush();
    expect(input.value).toBe(''); // set from outside
  });

  it('without `value` it keeps its own state and debounces as before', async () => {
    const onChange = vi.fn();
    act(() => root.render(<EasyVisionInput id="q" debounceMs={50} onChange={onChange} />));
    await flush();
    const input = document.querySelector('input') as HTMLInputElement;
    await type(input, 'x');
    expect(onChange).not.toHaveBeenCalled();
    await flush(80);
    expect(onChange).toHaveBeenCalledWith('x');
  });
});

describe('EasyVisionSelector, controlled', () => {
  it('shows the label of the value it is given, null as nothing, and reports a clear', async () => {
    const onChange = vi.fn();
    const options = [
      { value: 'a', label: 'Persona' },
      { value: 'b', label: 'Empresa' },
    ];
    const draw = (value: string | null) =>
      act(() =>
        root.render(
          <EasyVisionSelector
            id="type"
            options={options}
            value={value}
            onChange={onChange}
            placeholder="Elige"
            triggerProps={{ id: 'type-trigger', 'aria-label': 'Tipo' }}
          />
        )
      );
    draw('b');
    await flush();
    const trigger = document.getElementById('type-trigger')!;
    expect(trigger.getAttribute('aria-label')).toBe('Tipo');
    expect(trigger.textContent).toContain('Empresa');

    act(() => (document.querySelector('.ev-selector-clear') as HTMLButtonElement).click());
    expect(onChange).toHaveBeenCalledWith(undefined);
    // Controlled: nothing changes until the form says so.
    expect(document.getElementById('type-trigger')!.textContent).toContain('Empresa');

    draw(null);
    await flush();
    expect(document.getElementById('type-trigger')!.textContent).toContain('Elige');
  });
});
