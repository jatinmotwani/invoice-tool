import { type Dispatch, useId, useState } from 'react';
import { AA, contrastWithWhite } from '../../../lib/color';
import { TEMPLATES } from '../../../lib/invoice/constants';
import { Button, Section, Segmented } from '../fields';
import { resizeImage } from '../image';
import type { Action, EditorState } from '../state';

/** Preset accents, all ≥ 4.5:1 against white (tested). */
export const ACCENTS = [
  { value: '#1d4ed8', label: 'Blue' },
  { value: '#4338ca', label: 'Indigo' },
  { value: '#047857', label: 'Green' },
  { value: '#be123c', label: 'Red' },
  { value: '#b45309', label: 'Amber' },
  { value: '#334155', label: 'Slate' },
] as const;

const MAX_IMAGE_BYTES = 200 * 1024;

function ImagePicker({
  label,
  value,
  onChange,
  size,
}: {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
  size: { maxWidth: number; maxHeight: number };
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-800">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        {value && (
          <img src={value} alt="" className="h-12 max-w-40 rounded border border-slate-200 object-contain" />
        )}
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="block min-h-11 text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-4 file:text-base file:font-medium"
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setError(null);
            try {
              onChange(await resizeImage(file, { ...size, maxBytes: MAX_IMAGE_BYTES }));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Couldn’t read that image.');
            }
          }}
        />
        {value && (
          <Button variant="ghost" onClick={() => onChange('')}>
            Remove
          </Button>
        )}
      </div>
      <p id={`${id}-hint`} className="mt-1 text-sm text-slate-600">
        Resized on your device (max 200 KB). It never leaves your phone or computer.
      </p>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export default function Appearance({ state, dispatch }: { state: EditorState; dispatch: Dispatch<Action> }) {
  const a = state.profile.appearance;
  const set = (patch: Partial<typeof a>) => dispatch({ type: 'appearance', patch });
  const colorId = useId();
  const lowContrast = contrastWithWhite(a.accent) < AA;
  return (
    <Section title="Look" description="Logo, signature and colours, saved for every invoice.">
      <Segmented
        legend="Template"
        value={a.template}
        options={TEMPLATES.map((t) => ({ value: t, label: t === 'classic' ? 'Classic' : 'Modern' }))}
        onChange={(template) => set({ template })}
      />
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-800">Accent colour</legend>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENTS.map((c) => (
            <label
              key={c.value}
              className="relative flex size-11 cursor-pointer items-center justify-center rounded-full"
            >
              <input
                type="radio"
                name={colorId}
                className="peer sr-only"
                checked={a.accent.toLowerCase() === c.value}
                onChange={() => set({ accent: c.value })}
              />
              <span
                className={`swatch-${c.label.toLowerCase()} block size-8 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-slate-900 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600`}
              />
              <span className="sr-only">{c.label}</span>
            </label>
          ))}
          <label className="ml-2 flex min-h-11 items-center gap-2 text-sm">
            <input
              type="color"
              value={a.accent}
              onChange={(e) => set({ accent: e.target.value })}
              className="size-9 cursor-pointer rounded border border-slate-300"
            />
            Custom
          </label>
        </div>
        {lowContrast && (
          <p className="mt-1 text-sm text-amber-800">
            This colour is light; headings may be hard to read. Pick a darker one.
          </p>
        )}
      </fieldset>
      <ImagePicker
        label="Logo (optional)"
        value={a.logo}
        onChange={(logo) => set({ logo })}
        size={{ maxWidth: 600, maxHeight: 240 }}
      />
      <ImagePicker
        label="Signature (optional)"
        value={a.signature}
        onChange={(signature) => set({ signature })}
        size={{ maxWidth: 600, maxHeight: 200 }}
      />
    </Section>
  );
}
