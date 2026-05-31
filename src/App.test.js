import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the interior designer portfolio hero', () => {
  render(<App />);
  expect(screen.getByText(/interior designer portfolio/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /elegant interiors/i })).toBeInTheDocument();
});
