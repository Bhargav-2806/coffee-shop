import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MenuListItem from '../components/MenuListItem';

const mockItem = {
  id: 1,
  name: 'Flat White',
  description: 'Double shot of espresso with micro-foam.',
  price: 3.80,
};

describe('MenuListItem', () => {
  it('renders the item name', () => {
    render(<MenuListItem item={mockItem} />);
    expect(screen.getByText('Flat White')).toBeInTheDocument();
  });

  it('renders the item description', () => {
    render(<MenuListItem item={mockItem} />);
    expect(screen.getByText('Double shot of espresso with micro-foam.')).toBeInTheDocument();
  });

  it('renders the formatted price', () => {
    render(<MenuListItem item={mockItem} />);
    expect(screen.getByText('£3.80')).toBeInTheDocument();
  });
});
