import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

// Helper component that exposes auth state for assertions
function TestConsumer() {
  const { player, isAuthenticated, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="player">{player ? player.displayName : 'none'}</span>
      <button onClick={() => login('a@b.com', 'pass')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AuthProvider — bootstrap', () => {
  it('starts loading and resolves to unauthenticated when no token is stored', async () => {
    renderWithProvider();
    // Initially loading
    expect(screen.getByTestId('loading').textContent).toBe('true');
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false'),
    );
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('restores session when a valid token is in localStorage', async () => {
    localStorage.setItem('accessToken', 'valid-token');
    mockedApi.get.mockResolvedValueOnce({
      data: { id: '1', email: 'a@b.com', displayName: 'Alice', elo: 1200 },
    });

    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false'),
    );
    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('player').textContent).toBe('Alice');
  });

  it('clears token and stays unauthenticated when /players/me returns 401', async () => {
    localStorage.setItem('accessToken', 'expired-token');
    mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } });

    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false'),
    );
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(localStorage.getItem('accessToken')).toBeNull();
  });
});

describe('AuthProvider — login', () => {
  it('sets player and stores token on successful login', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('no token')); // bootstrap fails
    mockedApi.post.mockResolvedValueOnce({
      data: {
        accessToken: 'new-token',
        player: { id: '2', email: 'b@c.com', displayName: 'Bob', elo: 1400 },
      },
    });

    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false'),
    );

    await act(async () => {
      await userEvent.click(screen.getByText('Login'));
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('player').textContent).toBe('Bob');
    expect(localStorage.getItem('accessToken')).toBe('new-token');
  });
});

describe('AuthProvider — logout', () => {
  it('clears player and token on logout', async () => {
    localStorage.setItem('accessToken', 'tok');
    mockedApi.get.mockResolvedValueOnce({
      data: { id: '3', email: 'c@d.com', displayName: 'Carol', elo: 1100 },
    });
    mockedApi.post.mockResolvedValueOnce({});

    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId('authenticated').textContent).toBe('true'),
    );

    await act(async () => {
      await userEvent.click(screen.getByText('Logout'));
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('player').textContent).toBe('none');
    expect(localStorage.getItem('accessToken')).toBeNull();
  });
});
