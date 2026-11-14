import { melbourneDate } from '../../domain/dates';

export function AboutSection() {
  return (
    <section className="section" aria-labelledby="about-h">
      <h2 id="about-h">About</h2>
      <dl className="kv">
        <dt>Version</dt>
        <dd>{__APP_VERSION__}</dd>
        <dt>Built</dt>
        <dd>{melbourneDate(Date.parse(__BUILD_DATE__))}</dd>
      </dl>
    </section>
  );
}
