import React from 'react';
import { MenuItem } from '../types';

interface MenuListItemProps {
  item: MenuItem;
}

const MenuListItem: React.FC<MenuListItemProps> = ({ item }) => {
  return (
    <div className="py-6 border-b border-gray-200 last:border-0 group">
      <div className="flex items-baseline">
        <span className="font-serif text-xl font-medium text-text-dark group-hover:text-gold transition-colors duration-300">
          {item.name}
        </span>
        <span className="leader-line" />
        <span className="text-gold text-sm font-medium">
          £{item.price.toFixed(2)}
        </span>
      </div>
      <p className="text-text-muted text-[11px] font-sans mt-0.5 leading-relaxed max-w-sm">
        {item.description}
      </p>
    </div>
  );
};

export default MenuListItem;
