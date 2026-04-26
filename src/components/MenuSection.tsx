import React, { useState, useEffect } from 'react';
import MenuListItem from './MenuListItem';
import HoursCard from './HoursCard';
import { MenuApiResponse, MenuItem } from '../types';

const MenuSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'coffee' | 'pastries'>('coffee');
  const [menuData, setMenuData] = useState<MenuApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const response = await fetch('/api/menu');
        if (!response.ok) throw new Error('Failed to fetch menu');
        const data = await response.json();
        setMenuData(data);
      } catch (err) {
        setError('Menu unavailable right now. Please visit us in store.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMenu();
  }, []);

  const itemsToDisplay = activeTab === 'coffee' 
    ? menuData?.coffeeItems 
    : menuData?.pastryItems;

  return (
    <section id="menu" className="bg-cream py-24">
      <div className="max-w-7xl mx-auto px-6">
        <header className="flex items-baseline justify-between mb-12 border-b border-gray-200 pb-2">
          <h2 className="font-serif text-4xl text-text-dark">The Brew List</h2>
          
          <div className="flex gap-8">
            <button 
              onClick={() => setActiveTab('coffee')}
              className={`font-sans text-[10px] font-semibold tracking-wider-plus pb-1 transition-all duration-300 uppercase ${
                activeTab === 'coffee' 
                ? 'text-gold border-b-2 border-gold' 
                : 'text-text-muted border-b-2 border-transparent'
              }`}
            >
              COFFEE
            </button>
            <button 
              onClick={() => setActiveTab('pastries')}
              className={`font-sans text-[10px] font-semibold tracking-wider-plus pb-1 transition-all duration-300 uppercase ${
                activeTab === 'pastries' 
                ? 'text-gold border-b-2 border-gold' 
                : 'text-text-muted border-b-2 border-transparent'
              }`}
            >
              PASTRIES
            </button>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-16 mt-16">
          {/* Menu List */}
          <div className="flex-1">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="py-8 border-b border-gray-100 animate-pulse">
                    <div className="h-4 bg-gray-200 w-3/4 mb-4" />
                    <div className="h-3 bg-gray-100 w-full" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12 text-text-muted font-sans italic">
                {error}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                {itemsToDisplay?.map((item) => (
                  <MenuListItem key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>

          {/* Opening Hours Sidebar */}
          <div className="w-full lg:w-80 flex-shrink-0">
            {menuData && <HoursCard hours={menuData.openingHours} />}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MenuSection;
