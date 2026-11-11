'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Play, Search, Square } from 'lucide-react';
import type { VoiceGender, VoiceOption } from '@pv/shared';
import { ApiError, apiBlob } from '@/lib/api';
import { cn } from '@/lib/cn';

const GENDER_LABELS: Record<VoiceGender, string> = {
  female: 'Female',
  male: 'Male',
  neutral: 'Neutral',
};

/** Voices with no language of their own speak whatever language the agent does. */
const MULTILINGUAL = 'Multilingual';

const ALL = '';

function uniqueSorted(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Every voice the workspace can use, with filters (gender, accent, language,
 * style, name) and a sample to play before choosing. Samples are spoken in the
 * agent's language when the voice speaks several.
 */
export function VoicePicker({
  voices,
  value,
  onChange,
  language,
  disabled,
}: {
  voices: VoiceOption[];
  value: string;
  onChange: (id: string) => void;
  /** The agent's language, for the sample of a multilingual voice. */
  language: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState(ALL);
  const [accent, setAccent] = useState(ALL);
  const [lang, setLang] = useState(ALL);
  const [style, setStyle] = useState(ALL);

  const genders = useMemo(
    () =>
      (['female', 'male', 'neutral'] as const).filter((g) => voices.some((v) => v.gender === g)),
    [voices],
  );
  const accents = useMemo(() => uniqueSorted(voices.map((v) => v.accent)), [voices]);
  const languages = useMemo(() => {
    const own = uniqueSorted(voices.map((v) => v.language));
    return voices.some((v) => !v.language) && own.length ? [MULTILINGUAL, ...own] : own;
  }, [voices]);
  const styles = useMemo(() => uniqueSorted(voices.flatMap((v) => v.styles ?? [])), [voices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return voices.filter(
      (v) =>
        (!gender || v.gender === gender) &&
        (!accent || v.accent === accent) &&
        (!lang || (lang === MULTILINGUAL ? !v.language : v.language === lang)) &&
        (!style || v.styles?.includes(style)) &&
        (!q ||
          [v.label, v.hint, v.accent, v.language, ...(v.styles ?? [])]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q)),
    );
  }, [voices, query, gender, accent, lang, style]);

  const filtering = !!(query || gender || accent || lang || style);
  const clear = () => {
    setQuery('');
    setGender(ALL);
    setAccent(ALL);
    setLang(ALL);
    setStyle(ALL);
  };
  const selected = voices.find((v) => v.id === value);

  // One sample plays at a time; fetched samples are kept for this visit.
  const audio = useRef<HTMLAudioElement | null>(null);
  const samples = useRef(new Map<string, string>());
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    const urls = samples.current;
    return () => {
      audio.current?.pause();
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const stop = () => {
    audio.current?.pause();
    setPlaying(null);
  };

  const play = async (v: VoiceOption) => {
    if (playing === v.id) return stop();
    stop();
    setPreviewError(null);
    const key = `${v.id}|${v.language ? '' : language}`;
    let url = samples.current.get(key);
    if (!url) {
      setLoading(v.id);
      try {
        const blob = await apiBlob(
          `/app/ai/voices/${encodeURIComponent(v.id)}/preview?lang=${encodeURIComponent(language)}`,
        );
        url = URL.createObjectURL(blob);
        samples.current.set(key, url);
      } catch (err) {
        setPreviewError(
          err instanceof ApiError ? err.message : 'That sample couldn’t be played. Try again.',
        );
        return;
      } finally {
        setLoading((l) => (l === v.id ? null : l));
      }
    }
    if (!audio.current) audio.current = new Audio();
    const el = audio.current;
    el.src = url;
    el.onended = () => setPlaying(null);
    el.onerror = () => {
      setPlaying(null);
      setPreviewError('That sample couldn’t be played. Try again.');
    };
    setPlaying(v.id);
    el.play().catch(() => setPlaying(null));
  };

  const describe = (v: VoiceOption) =>
    [
      v.gender ? GENDER_LABELS[v.gender] : undefined,
      v.accent,
      v.language ?? (languages.length ? MULTILINGUAL : undefined),
      v.custom ? 'Custom' : undefined,
    ]
      .filter(Boolean)
      .join(' · ');

  const filterSelect = (
    id: string,
    label: string,
    val: string,
    set: (v: string) => void,
    options: { value: string; label: string }[],
  ) =>
    options.length > 1 && (
      <label htmlFor={id} className="block">
        <span className="sr-only">{label}</span>
        <select
          id={id}
          className="select h-10"
          value={val}
          disabled={disabled}
          onChange={(e) => set(e.target.value)}
        >
          <option value={ALL}>{`Any ${label.toLowerCase()}`}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        <label htmlFor="voice-search" className="relative col-span-2 block lg:col-span-1">
          <span className="sr-only">Search voices</span>
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="voice-search"
            type="search"
            className="input h-10 pl-9"
            placeholder="Search voices"
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {filterSelect(
          'voice-gender',
          'Gender',
          gender,
          setGender,
          genders.map((g) => ({ value: g, label: GENDER_LABELS[g] })),
        )}
        {filterSelect(
          'voice-accent',
          'Accent',
          accent,
          setAccent,
          accents.map((a) => ({ value: a, label: a })),
        )}
        {filterSelect(
          'voice-language',
          'Language',
          lang,
          setLang,
          languages.map((l) => ({ value: l, label: l })),
        )}
        {filterSelect(
          'voice-style',
          'Style',
          style,
          setStyle,
          styles.map((s) => ({ value: s, label: titleCase(s) })),
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span aria-live="polite">
          {filtering ? `${filtered.length} of ${voices.length} voices` : `${voices.length} voices`}
          {selected && (
            <>
              {' '}
              · Selected: <b className="text-ink">{selected.label}</b>
            </>
          )}
        </span>
        {filtering && (
          <button
            type="button"
            className="font-semibold text-brand-700 hover:underline"
            onClick={clear}
          >
            Clear filters
          </button>
        )}
      </div>

      {previewError && (
        <p className="field-error" role="alert">
          {previewError}
        </p>
      )}

      <div
        role="radiogroup"
        aria-label="Voice"
        className="grid max-h-[26rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3"
      >
        {filtered.length === 0 && (
          <p className="col-span-full rounded-sm bg-canvas px-4 py-6 text-center text-sm text-muted">
            No voices match these filters.{' '}
            <button
              type="button"
              className="font-semibold text-brand-700 hover:underline"
              onClick={clear}
            >
              Clear filters
            </button>
          </p>
        )}
        {filtered.map((v) => {
          const isSelected = v.id === value;
          const isPlaying = playing === v.id;
          const isLoading = loading === v.id;
          return (
            <div
              key={v.id}
              className={cn(
                'flex items-start gap-3 rounded-sm border bg-surface p-3 transition',
                isSelected
                  ? 'border-brand-500 ring-2 ring-brand-100'
                  : 'border-line hover:border-brand-300',
              )}
            >
              <button
                type="button"
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition',
                  isPlaying
                    ? 'bg-ink text-white'
                    : 'bg-brand-100 text-brand-800 hover:bg-brand-200',
                )}
                aria-label={isPlaying ? `Stop ${v.label} sample` : `Play ${v.label} sample`}
                disabled={disabled || (!!loading && !isLoading)}
                onClick={() => play(v)}
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : isPlaying ? (
                  <Square size={14} fill="currentColor" aria-hidden="true" />
                ) : (
                  <Play size={16} fill="currentColor" className="ml-0.5" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled}
                className="min-w-0 flex-1 text-left"
                onClick={() => onChange(v.id)}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <span className="truncate">{v.label}</span>
                  {v.hint === 'Recommended' && (
                    <span className="badge badge-brand">Recommended</span>
                  )}
                  {isSelected && (
                    <Check
                      size={16}
                      className="ml-auto shrink-0 text-brand-700"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted">{describe(v)}</span>
                {!!v.styles?.length && (
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {v.styles.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className="badge badge-neutral px-2 py-0 text-[11px] font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
