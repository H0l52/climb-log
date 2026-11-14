import { GymsSection } from './GymsSection';
import { WallsSection } from './WallsSection';
import { GradeBandsSection } from './GradeBandsSection';
import { StorageSection } from './StorageSection';
import { AboutSection } from './AboutSection';

export function SettingsScreen() {
  return (
    <section className="screen" aria-labelledby="screen-title">
      <h1 id="screen-title" className="screen-title">Settings</h1>
      <WallsSection />
      <GradeBandsSection />
      <GymsSection />
      <StorageSection />
      <AboutSection />
    </section>
  );
}
