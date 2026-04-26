import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FeatureStrip from '../components/FeatureStrip';

describe('FeatureStrip', () => {
  it('renders Single Origin feature', () => {
    render(<FeatureStrip />);
    expect(screen.getByText('Single Origin')).toBeInTheDocument();
  });

  it('renders Fresh Pastries feature', () => {
    render(<FeatureStrip />);
    expect(screen.getByText('Fresh Pastries')).toBeInTheDocument();
  });

  it('renders London Bridge feature', () => {
    render(<FeatureStrip />);
    expect(screen.getByText('London Bridge')).toBeInTheDocument();
  });
});
