import { cn } from '@/lib/cn';

/** Label + control + help/error, with the ids wired for screen readers. */
export function Field({
  id,
  label,
  help,
  error,
  children,
  className,
  optional,
}: {
  id: string;
  label: string;
  help?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {optional && <span className="ml-1 font-normal text-subtle">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="help">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn(
        'rounded-sm border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-medium text-danger',
        className,
      )}
    >
      {message}
    </p>
  );
}
