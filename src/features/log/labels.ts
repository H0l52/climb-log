import type { Attempt } from '../../db/types';

/** 'Flash', 'Sent', 'Sent · 3 tries', 'Not yet · 2 tries'. */
export function resultLabel(attempt: Pick<Attempt, 'result' | 'tries'>): string {
  if (attempt.result === 'flash') return 'Flash';
  const tries = attempt.tries === 1 ? '' : ` · ${attempt.tries} tries`;
  return `${attempt.result === 'send' ? 'Sent' : 'Not yet'}${tries}`;
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
