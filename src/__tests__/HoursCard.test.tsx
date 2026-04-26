import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HoursCard from '../components/HoursCard';

const mockHours = [
  { day: 'Mon – Fri', hours: '07:00 → 19:00' },
  { day: 'Saturday', hours: '08:00 → 18:00' },
  { day: 'Sunday', hours: '09:00 → 17:00' },
];

describe('HoursCard', () => {
  it('renders Opening Hours heading', () => {
    render(<HoursCard hours={mockHours} />);
    expect(screen.getByText('Opening Hours')).toBeInTheDocument();
  });

  it('renders all day labels', () => {
    render(<HoursCard hours={mockHours} />);
    expect(screen.getByText('Mon – Fri')).toBeInTheDocument();
    expect(screen.getByText('Saturday')).toBeInTheDocument();
    expect(screen.getByText('Sunday')).toBeInTheDocument();
  });

  it('renders all hours values', () => {
    render(<HoursCard hours={mockHours} />);
    expect(screen.getByText('07:00 → 19:00')).toBeInTheDocument();
    expect(screen.getByText('08:00 → 18:00')).toBeInTheDocument();
    expect(screen.getByText('09:00 → 17:00')).toBeInTheDocument();
  });
});
