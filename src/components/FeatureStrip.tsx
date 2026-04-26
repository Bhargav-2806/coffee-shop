import React from 'react';
import { Coffee, Croissant, MapPin } from 'lucide-react';

const FeatureStrip: React.FC = () => {
  return (
    <section id="features" className="w-full bg-espresso text-white">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3">
        {/* Feature 1 */}
        <div className="py-10 px-8 flex flex-col items-center text-center border-b md:border-b-0 md:border-r border-gold/30 last:border-0">
          <Coffee className="text-gold mb-4" size={20} />
          <h3 className="font-sans text-xs font-medium tracking-wide">Single Origin</h3>
          <p className="font-sans text-[10px] text-white/40 mt-2 max-w-[140px] leading-relaxed">
            Ethically sourced beans from the high altitudes of Ethiopia and Brazil.
          </p>
        </div>

        {/* Feature 2 */}
        <div className="py-10 px-8 flex flex-col items-center text-center border-b md:border-b-0 md:border-r border-gold/30 last:border-0">
          <Croissant className="text-gold mb-4" size={20} />
          <h3 className="font-sans text-xs font-medium tracking-wide">Fresh Pastries</h3>
          <p className="font-sans text-[10px] text-white/40 mt-2 max-w-[140px] leading-relaxed">
            Hand-rolled croissants and artisan sourdough baked fresh every morning.
          </p>
        </div>

        {/* Feature 3 */}
        <div className="py-10 px-8 flex flex-col items-center text-center last:border-0">
          <MapPin className="text-gold mb-4" size={20} />
          <h3 className="font-sans text-xs font-medium tracking-wide">London Bridge</h3>
          <p className="font-sans text-[10px] text-white/40 mt-2 max-w-[140px] leading-relaxed">
            A sanctuary of calm nestled just steps away from the iconic bridge.
          </p>
        </div>
      </div>
    </section>
  );
};

export default FeatureStrip;
