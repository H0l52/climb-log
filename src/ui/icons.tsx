// Simple inline stroke icons (no icon font, no network).
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const IconToday = () => (
  <svg {...base}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
);
export const IconWalls = () => (
  <svg {...base}><path d="M4 21V5l8-2 8 2v16" /><circle cx="9" cy="9" r="1.2" /><circle cx="15" cy="12" r="1.2" /><circle cx="10" cy="16" r="1.2" /></svg>
);
export const IconProgress = () => (
  <svg {...base}><path d="M5 20v-5M12 20V9M19 20V4" /></svg>
);
export const IconGoals = () => (
  <svg {...base}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
);
export const IconMore = () => (
  <svg {...base}><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
);
