import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CoachList from '../CoachList';

const createFetchResponse = (payload: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => payload,
  }) as Response;

describe('CoachList integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders coach data fetched from the API', async () => {
    const payload = {
      data: [
        {
          id: 42,
          first_name: 'Alex',
          last_name: 'Morgan',
          bio: 'Former collegiate tennis champion with 10 years of coaching experience.',
          lesson_rate: { amount: 110, currency: 'USD' },
          availability: [
            { day: 'Monday', start: '07:00', end: '10:00' },
            { day: 'Tuesday', start: '07:00', end: '10:00' },
            { day: 'Wednesday', start: '07:00', end: '10:00' },
            { day: 'Thursday', start: '07:00', end: '10:00' },
            { day: 'Friday', start: '07:00', end: '10:00' },
          ],
          locations: [
            { name: 'Bay Club San Mateo', city: 'San Mateo', state: 'CA', postalCode: '94403' },
            { name: 'San Carlos Courts', city: 'San Carlos', state: 'CA', postalCode: '94070' },
          ],
          profile_image_url: 'https://example.com/avatar.jpg',
        },
      ],
    };

    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(createFetchResponse(payload));

    render(
      <MemoryRouter>
        <CoachList />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Alex Morgan' })).toBeInTheDocument();
    expect(screen.getByText(/\$110/)).toBeInTheDocument();
    expect(screen.getByText('Weekdays 7am–10am')).toBeInTheDocument();
    expect(screen.getByText('Bay Club San Mateo — San Mateo, CA')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View full profile/i })).toHaveAttribute('href', '/coaches/42');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/player/coaches'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });
});
