import React, { useState, useEffect } from 'react';
import { MapPin, Train } from 'lucide-react';
import { LocationApiResponse } from '../types';

const LocationSection: React.FC = () => {
  const [locationData, setLocationData] = useState<LocationApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const response = await fetch('/api/location');
        if (!response.ok) throw new Error('Failed to fetch location');
        const data = await response.json();
        setLocationData(data);
      } catch (err) {
        setError('Location info unavailable. Call us: +44 20 1234 5678');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLocation();
  }, []);

  return (
    <section id="location" className="bg-cream-dark py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
        
        {/* Left Column - Photography stack */}
        <div className="relative h-[500px] flex items-center justify-center">
          {isLoading ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute left-0 top-0 w-64 h-80 bg-gray-200 animate-pulse rotate-[-3deg] shadow-lg" />
              <div className="absolute left-24 top-16 w-64 h-80 bg-gray-300 animate-pulse rotate-[3deg] shadow-xl z-10" />
            </div>
          ) : locationData ? (
            <div className="relative w-full h-full">
              {/* Photo 1 (Back) */}
              <div className="absolute left-0 top-0 w-64 h-80 polaroid-frame rotate-[-4deg] transition-transform hover:rotate-[-2deg] duration-500">
                <img 
                  src={locationData.photos[0].url} 
                  alt={locationData.photos[0].alt} 
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Photo 2 (Front) */}
              <div className="absolute left-32 top-20 w-64 h-80 polaroid-frame rotate-[3deg] z-10 transition-transform hover:rotate-[1deg] duration-500">
                <img 
                  src={locationData.photos[1].url} 
                  alt={locationData.photos[1].alt} 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Column - Info */}
        <div className="flex flex-col justify-center">
          <h2 className="font-serif text-5xl text-text-dark mb-10 leading-[1.1]">
            Find Us by<br />the River
          </h2>

          {error ? (
            <p className="text-text-muted font-sans italic">{error}</p>
          ) : (
            <div className="space-y-10">
              {/* Address */}
              <div className="flex items-start gap-5">
                <div className="mt-1">
                  <MapPin size={20} className="text-gold" />
                </div>
                <div>
                  <span className="block font-sans text-[10px] font-medium tracking-widest text-gold uppercase mb-1">
                    Address
                  </span>
                  <p className="font-sans text-sm text-text-dark leading-relaxed">
                    {locationData?.address.line1}<br />
                    {locationData?.address.line2}
                  </p>
                </div>
              </div>

              {/* Transport */}
              <div className="flex items-start gap-5">
                <div className="mt-1">
                  <Train size={20} className="text-gold" />
                </div>
                <div>
                  <span className="block font-sans text-[10px] font-medium tracking-widest text-gold uppercase mb-1">
                    Transport
                  </span>
                  {locationData?.transport.map((t, idx) => (
                    <p key={idx} className="font-sans text-sm text-text-dark">
                      {t}
                    </p>
                  ))}
                </div>
              </div>

              <button className="bg-brown text-cream text-[10px] font-sans font-medium tracking-widest px-8 py-4 mt-4 hover:bg-espresso transition-colors">
                GET DIRECTIONS →
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default LocationSection;
