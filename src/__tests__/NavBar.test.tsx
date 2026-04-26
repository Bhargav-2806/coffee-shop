import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NavBar from '../components/NavBar';

describe('NavBar', () => {
  it('renders the brand name', () => {
    render(<NavBar />);
    expect(screen.getByText('The London Brew')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<NavBar />);
    expect(screen.getAllByText('Menu').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Find Us').length).toBeGreaterThan(0);
    expect(screen.getAllByText('About').length).toBeGreaterThan(0);
  });

  it('renders the Order Ahead button', () => {
    render(<NavBar />);
    expect(screen.getAllByText(/Order Ahead/i).length).toBeGreaterThan(0);
  });
});
