import { type ReactNode, useId, useState } from 'react';

const inputClass =
  'block w-full min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30 ' +
  'aria-[invalid=true]:border-red-600';

interface FieldProps {
  label: string;
  hint?: ReactNode | undefined;
  error?: string | null | undefined;
  className?: string | undefined;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Label + control + hint/error, wired up with ids for screen readers. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-slate-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode | undefined;
  error?: string | null | undefined;
  placeholder?: string | undefined;
  type?: 'text' | 'email' | 'tel' | 'date' | undefined;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | undefined;
  autoComplete?: string | undefined;
  maxLength?: number | undefined;
  uppercase?: boolean | undefined;
  list?: string | undefined;
  className?: string | undefined;
}

export function TextInput(props: TextProps) {
  return (
    <Field label={props.label} hint={props.hint} error={props.error} className={props.className}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          className={inputClass + (props.uppercase ? ' uppercase' : '')}
          type={props.type ?? 'text'}
          value={props.value}
          placeholder={props.placeholder}
          inputMode={props.inputMode}
          autoComplete={props.autoComplete ?? 'off'}
          maxLength={props.maxLength}
          list={props.list}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          onChange={(e) => props.onChange(props.uppercase ? e.target.value.toUpperCase() : e.target.value)}
        />
      )}
    </Field>
  );
}

export function TextArea(props: Omit<TextProps, 'type' | 'inputMode' | 'list'> & { rows?: number }) {
  return (
    <Field label={props.label} hint={props.hint} error={props.error} className={props.className}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          className={inputClass}
          rows={props.rows ?? 3}
          value={props.value}
          placeholder={props.placeholder}
          maxLength={props.maxLength}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: ReactNode | undefined;
  error?: string | null | undefined;
  className?: string | undefined;
}

export function Select<T extends string>(props: SelectProps<T>) {
  return (
    <Field label={props.label} hint={props.hint} error={props.error} className={props.className}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          className={inputClass}
          value={props.value}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          onChange={(e) => props.onChange(e.target.value as T)}
        >
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** Integer scaled by 10^digits → editable decimal text ("1500", "1500.5"). */
export function scaledToText(value: number, digits: number): string {
  if (digits === 0) return String(value);
  const scale = 10 ** digits;
  const whole = Math.floor(value / scale);
  const frac = String(value % scale)
    .padStart(digits, '0')
    .replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : String(whole);
}

interface DecimalProps {
  label: string;
  /** Integer scaled by 10^digits (paise, basis points, thousandths). */
  value: number;
  digits: number;
  parse: (text: string) => number | null;
  onChange: (value: number) => void;
  hint?: ReactNode | undefined;
  prefix?: string | undefined;
  suffix?: string | undefined;
  className?: string | undefined;
  placeholder?: string | undefined;
}

/** Decimal input that keeps what the user types and reports integer values; empty means 0. */
export function DecimalInput(props: DecimalProps) {
  const [text, setText] = useState<string | null>(null);
  const shown =
    text ?? (props.value === 0 && props.placeholder ? '' : scaledToText(props.value, props.digits));
  const parsed = text === null || text.trim() === '' ? 0 : props.parse(text);
  const error = parsed === null ? 'Enter a number' : null;
  return (
    <Field label={props.label} hint={props.hint} error={error} className={props.className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {props.prefix && (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
              {props.prefix}
            </span>
          )}
          <input
            id={id}
            className={inputClass + (props.prefix ? ' pl-8' : '') + (props.suffix ? ' pr-8' : '')}
            inputMode="decimal"
            autoComplete="off"
            value={shown}
            placeholder={props.placeholder}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onFocus={() => setText(shown)}
            onBlur={() => setText(null)}
            onChange={(e) => {
              setText(e.target.value);
              const v = e.target.value.trim() === '' ? 0 : props.parse(e.target.value);
              if (v !== null) props.onChange(v);
            }}
          />
          {props.suffix && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
              {props.suffix}
            </span>
          )}
        </div>
      )}
    </Field>
  );
}

export function Toggle(props: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: ReactNode | undefined;
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-start gap-3">
      <input
        id={id}
        type="checkbox"
        className="mt-1 size-5 shrink-0 accent-blue-700"
        checked={props.checked}
        aria-describedby={props.hint ? `${id}-hint` : undefined}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <div>
        <label htmlFor={id} className="text-base text-slate-900">
          {props.label}
        </label>
        {props.hint && (
          <p id={`${id}-hint`} className="text-sm text-slate-600">
            {props.hint}
          </p>
        )}
      </div>
    </div>
  );
}

/** Radio group styled as a segmented control. */
export function Segmented<T extends string>(props: {
  legend: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-slate-800">{props.legend}</legend>
      <div className="inline-flex rounded-md border border-slate-300 p-0.5">
        {props.options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-10 cursor-pointer items-center rounded px-3 text-sm has-checked:bg-blue-700 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-blue-600"
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={o.value}
              checked={props.value === o.value}
              onChange={() => props.onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Section(props: { title: string; children: ReactNode; description?: ReactNode | undefined }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
      <h2 className="text-base font-semibold text-slate-900">{props.title}</h2>
      {props.description && <p className="mt-1 text-sm text-slate-600">{props.description}</p>}
      <div className="mt-3 space-y-3">{props.children}</div>
    </section>
  );
}

export function Button(props: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  ariaLabel?: string | undefined;
}) {
  const variant = {
    primary: 'bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-400',
    secondary: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
    ghost: 'text-blue-800 hover:bg-blue-50',
  }[props.variant ?? 'secondary'];
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-base font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${variant} ${props.className ?? ''}`}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.ariaLabel}
    >
      {props.children}
    </button>
  );
}
