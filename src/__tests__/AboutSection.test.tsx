import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AboutSection from '../components/AboutSection';

describe('AboutSection', () => {
  it('renders the heritage heading', () => {
    render(<AboutSection />);
    expect(screen.getByText('A Legacy of Roasting')).toBeInTheDocument();
  });

  it('renders the section label', () => {
    render(<AboutSection />);
    expect(screen.getByText('THE HERITAGE')).toBeInTheDocument();
  });

  it('renders key content bullet points', () => {
    render(<AboutSection />);
    expect(screen.getByText(/Traditional slow-roasting/i)).toBeInTheDocument();
    expect(screen.getByText(/Direct trade relationships/i)).toBeInTheDocument();
  });
});
