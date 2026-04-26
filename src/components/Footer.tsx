import React from 'react';
import { Mail, Instagram, Twitter } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer id="footer" className="bg-espresso text-white border-t border-gold/20">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row justify-between items-start gap-12">
          {/* Logo & About */}
          <div className="max-w-[280px]">
            <h3 className="font-serif text-xl text-cream">The London Brew</h3>
            <p className="font-sans text-xs text-white/40 mt-4 leading-relaxed">
              Elevating your daily ritual through mastery and heritage. 
              Our coffee is sourced with ethics and brewed with precision.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-12 gap-y-4">
            <a href="#" className="font-sans text-xs text-white/60 hover:text-gold transition-colors">Privacy Policy</a>
            <a href="#" className="font-sans text-xs text-white/60 hover:text-gold transition-colors">Terms of Service</a>
            <a href="#" className="font-sans text-xs text-white/60 hover:text-gold transition-colors">Careers</a>
            <a href="#" className="font-sans text-xs text-white/60 hover:text-gold transition-colors">Contact</a>
          </div>

          {/* Social */}
          <div className="flex gap-5">
            <a href="#" className="p-2 border border-white/10 hover:border-gold hover:text-gold transition-all">
              <Mail size={16} />
            </a>
            <a href="#" className="p-2 border border-white/10 hover:border-gold hover:text-gold transition-all">
              <Instagram size={16} />
            </a>
            <a href="#" className="p-2 border border-white/10 hover:border-gold hover:text-gold transition-all">
              <Twitter size={16} />
            </a>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-16 pt-8 border-t border-white/5 flex justify-between items-center text-center">
          <p className="font-sans text-[9px] tracking-[0.1em] text-white/30 uppercase">
            © 2024 The London Brew. Artisanal Craftsmanship.
          </p>
          <div className="flex gap-4">
            <span className="text-[9px] text-white/40 hover:text-gold cursor-pointer transition-colors">Instagram</span>
            <span className="text-[9px] text-white/40 hover:text-gold cursor-pointer transition-colors">Twitter</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
