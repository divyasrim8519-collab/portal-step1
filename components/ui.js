export function Loading({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-600">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ message = 'Something went wrong.', onRetry }) {
  return (
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 rounded border border-red-400 bg-white px-3 py-1 font-medium hover:bg-red-100">
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ title, hint }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
    </div>
  );
}

const TONES = {
  gray: 'bg-slate-100 text-slate-800 border-slate-300',
  green: 'bg-green-50 text-green-900 border-green-300',
  amber: 'bg-amber-50 text-amber-900 border-amber-400',
  red: 'bg-red-50 text-red-900 border-red-300',
  blue: 'bg-sky-50 text-sky-900 border-sky-300',
};
export function Badge({ tone = 'gray', children }) {
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export const sevTone = { LOW: 'gray', MEDIUM: 'amber', HIGH: 'red' };
export const statusTone = { PENDING: 'amber', APPROVED: 'green', REJECTED: 'red', DISMISSED: 'gray' };
export const CATEGORY_LABEL = {
  CONTACT_SHARING: 'Contact sharing', OFF_PLATFORM: 'Off-platform', COMMERCIAL: 'Commercial', ABUSE: 'Abuse',
};

export const btn = 'rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';
export const btnPrimary = `${btn} bg-brand text-white hover:bg-brand-dark`;
export const btnGhost = `${btn} border border-slate-300 bg-white hover:bg-slate-50`;
export const inputCls = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
