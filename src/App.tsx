/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import NavBar from './components/NavBar';
import HeroSection from './components/HeroSection';
import FeatureStrip from './components/FeatureStrip';
import AboutSection from './components/AboutSection';
import MenuSection from './components/MenuSection';
import LocationSection from './components/LocationSection';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen bg-cream selection:bg-gold/30">
      <NavBar />
      <main>
        <HeroSection />
        <FeatureStrip />
        <AboutSection />
        <MenuSection />
        <LocationSection />
      </main>
      <Footer />
    </div>
  );
}
