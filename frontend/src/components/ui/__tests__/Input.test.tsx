import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Input from '../Input';

describe('Input component', () => {
  it('renders correctly with label', () => {
    render(<Input label="Username" placeholder="Enter username" />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter username/i)).toBeInTheDocument();
  });

  it('handles value changes', () => {
    const handleChange = vi.fn();
    render(<Input label="Username" onChange={handleChange} />);
    const input = screen.getByLabelText(/username/i);
    fireEvent.change(input, { target: { value: 'testuser' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('displays error message', () => {
    render(<Input label="Username" error="Field is required" />);
    expect(screen.getByText(/field is required/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toHaveClass('border-red-500');
  });

  it('renders with icons', () => {
    render(
      <Input 
        label="Search" 
        leftIcon={<span data-testid="left-icon">🔍</span>} 
      />
    );
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    expect(screen.getByLabelText(/search/i)).toHaveClass('pl-11');
  });
});
