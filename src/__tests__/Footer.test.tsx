import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '../components/Footer';

describe('Footer', () => {
  it('renders brand name', () => {
    render(<Footer />);
    expect(screen.getByText('The London Brew')).toBeInTheDocument();
  });

  it('renders copyright text', () => {
    render(<Footer />);
    expect(screen.getByText(/2024 The London Brew/i)).toBeInTheDocument();
  });

  it('renders footer links', () => {
    render(<Footer />);
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Careers')).toBeInTheDocument();
  });
});
