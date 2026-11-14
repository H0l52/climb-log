import type { ReactNode } from 'react';

export function Placeholder({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="screen" aria-labelledby="screen-title">
      <h1 id="screen-title" className="screen-title">{title}</h1>
      <div className="empty">{children}</div>
    </section>
  );
}
