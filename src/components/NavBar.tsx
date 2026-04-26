import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const NavBar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      id="navbar"
      className={`fixed top-0 left-0 w-full z-50 bg-white transition-shadow duration-300 ${
        isScrolled ? 'shadow-md' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-10 h-16 flex items-center justify-between">
        <div className="text-2xl font-serif font-bold text-espresso tracking-tight">
          The London Brew
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-10">
          <a href="#menu" className="text-sm font-medium border-b-2 border-gold text-text-dark pb-1 transition-colors">Menu</a>
          <a href="#location" className="text-sm font-medium text-text-muted hover:text-text-dark pb-1 transition-colors">Find Us</a>
          <a href="#about" className="text-sm font-medium text-text-muted hover:text-text-dark pb-1 transition-colors">About</a>
        </div>

        <div className="hidden md:block">
          <button className="bg-espresso text-white px-6 py-2.5 text-xs font-semibold tracking-widest uppercase transition-colors hover:bg-brown">
            Order Ahead
          </button>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden text-espresso"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 py-6 px-6 flex flex-col gap-4">
          <a 
            href="#menu" 
            className="text-sm font-sans font-medium text-text-dark"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Menu
          </a>
          <a 
            href="#location" 
            className="text-sm font-sans font-medium text-text-muted"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Find Us
          </a>
          <a 
            href="#about" 
            className="text-sm font-sans font-medium text-text-muted"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            About
          </a>
          <button className="bg-espresso text-white text-xs font-sans font-medium tracking-widest py-4 w-full mt-4">
            ORDER AHEAD
          </button>
        </div>
      )}
    </nav>
  );
};

export default NavBar;
