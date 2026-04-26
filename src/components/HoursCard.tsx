import React from 'react';
import { OpeningHour } from '../types';

interface HoursCardProps {
  hours: OpeningHour[];
}

const HoursCard: React.FC<HoursCardProps> = ({ hours }) => {
  return (
    <div className="bg-brown p-6 shadow-2xl relative">
      <h4 className="text-white font-serif text-lg mb-4">Opening Hours</h4>
      <div className="space-y-4 border-t border-gold/40 pt-4">
        {hours.map((item, idx) => (
          <div key={idx}>
            <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">{item.day}</p>
            <p className="text-sm text-cream font-medium">{item.hours}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-gold/20">
        <div className="text-[9px] tracking-widest text-gold uppercase text-center font-bold">
          Located at The Arches
        </div>
      </div>
    </div>
  );
};

export default HoursCard;
