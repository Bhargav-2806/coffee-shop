import React from 'react';
import { motion } from 'motion/react';

const HeroSection: React.FC = () => {
  const scrollToMenu = () => {
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section 
      id="hero" 
      className="relative h-screen w-full flex items-center justify-center overflow-hidden"
    >
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1600)' }}
      />
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/55" />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto text-white">
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="font-serif text-6xl md:text-7xl font-semibold leading-[1.1]"
        >
          Crafted for London.<br />Brewed for You.
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="font-sans text-sm md:text-base text-white/70 max-w-sm mx-auto mt-6 leading-relaxed"
        >
          Experience the precision of artisanal coffee in the heart of the city. 
          Traditional techniques meet contemporary taste.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          onClick={scrollToMenu}
          className="mt-10 border border-white text-white bg-transparent hover:bg-white hover:text-espresso transition-all px-10 py-3.5 text-[10px] tracking-widest-plus font-medium uppercase"
        >
          SEE OUR MENU
        </motion.button>
      </div>
    </section>
  );
};

export default HeroSection;
