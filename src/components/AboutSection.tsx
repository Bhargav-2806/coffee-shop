import React from 'react';

const AboutSection: React.FC = () => {
  return (
    <section id="about" className="bg-cream w-full overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row min-h-[600px]">
        {/* Left Column - Image */}
        <div className="w-full md:w-1/2">
          <img 
            src="https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=1000" 
            alt="Espresso shot pull" 
            className="w-full h-full object-cover min-h-[400px]"
          />
        </div>

        {/* Right Column - Content */}
        <div className="w-full md:w-1/2 flex flex-col justify-center py-16 px-10 md:pl-20 md:pr-10">
          <span className="font-sans text-[10px] font-medium tracking-wider-plus text-gold uppercase">
            THE HERITAGE
          </span>
          <h2 className="font-serif text-4xl text-text-dark mt-2">
            A Legacy of Roasting
          </h2>
          <p className="font-sans text-sm text-text-muted mt-5 leading-relaxed max-w-lg">
            Born from a passion for the perfect pull, The London Brew has 
            been serving the Southwark community with uncompromising quality 
            for over a decade. Every cup is a testament to our artisanal roots.
          </p>

          <div className="mt-10 space-y-4">
            <div className="flex items-start gap-4">
              <span className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 flex-shrink-0" />
              <p className="font-sans text-sm text-text-dark">Traditional slow-roasting techniques used daily</p>
            </div>
            <div className="flex items-start gap-4">
              <span className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 flex-shrink-0" />
              <p className="font-sans text-sm text-text-dark">Direct trade relationships with small-scale farmers</p>
            </div>
            <div className="flex items-start gap-4">
              <span className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 flex-shrink-0" />
              <p className="font-sans text-sm text-text-dark">Expertly trained baristas with a focus on hospitality</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
