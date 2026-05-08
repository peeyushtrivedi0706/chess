import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface GameHistorySummary {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
}

interface ProfileFormState {
  displayName: string;
  avatarUrl: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function ProfilePage() {
  const { player, refreshPlayer, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<ProfileFormState>({
    displayName: player?.displayName ?? '',
    avatarUrl: player?.avatarUrl ?? '',
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [stats, setStats] = useState<GameHistorySummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Sync form when player data loads/changes
  useEffect(() => {
    if (player) {
      setForm({
        displayName: player.displayName,
        avatarUrl: player.avatarUrl ?? '',
      });
    }
  }, [player]);

  // Fetch game history summary
  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    setStatsError(null);
    api
      .get<GameHistorySummary>('/players/me/stats')
      .then(({ data }) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setStatsError('Failed to load statistics.');
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.displayName.trim()) {
        setSaveError('Display name cannot be empty.');
        return;
      }
      setSaveStatus('saving');
      setSaveError(null);
      try {
        await api.patch('/players/me', {
          displayName: form.displayName.trim(),
          avatarUrl: form.avatarUrl.trim() || undefined,
        });
        await refreshPlayer();
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to save profile.';
        setSaveError(message);
        setSaveStatus('error');
      }
    },
    [form, refreshPlayer]
  );

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const winRate =
    stats && stats.totalGames > 0
      ? ((stats.wins / stats.totalGames) * 100).toFixed(1)
      : null;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>♟ Chess Portal</h1>
        <nav style={styles.nav}>
          <button style={styles.navBtn} onClick={() => navigate('/')}>
            Dashboard
          </button>
          <button style={styles.navBtn} onClick={() => navigate('/history')}>
            History
          </button>
          <button style={{ ...styles.navBtn, ...styles.navBtnActive }}>
            Profile
          </button>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </header>

      <main style={styles.main}>
        {/* Avatar + identity */}
        <section style={styles.card}>
          <div style={styles.avatarWrapper}>
            {player?.avatarUrl ? (
              <img
                src={player.avatarUrl}
                alt={player.displayName}
                style={styles.avatar}
              />
            ) : (
              <div style={styles.avatarPlaceholder}>
                {player?.displayName?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>
          <div style={styles.identity}>
            <h2 style={styles.displayName}>{player?.displayName}</h2>
            <p style={styles.email}>{player?.email}</p>
            <div style={styles.eloBadge}>
              <span style={styles.eloLabel}>ELO</span>
              <span style={styles.eloValue}>{player?.elo ?? '—'}</span>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section style={styles.card}>
          <h3 style={styles.sectionTitle}>Statistics</h3>
          {statsLoading && <p style={styles.muted}>Loading statistics…</p>}
          {statsError && <p style={styles.errorText}>{statsError}</p>}
          {stats && !statsLoading && (
            <div style={styles.statsGrid}>
              <StatBox label="Games" value={stats.totalGames} />
              <StatBox label="Wins" value={stats.wins} color="#22c55e" />
              <StatBox label="Losses" value={stats.losses} color="#ef4444" />
              <StatBox label="Draws" value={stats.draws} color="#f59e0b" />
              {winRate !== null && (
                <StatBox label="Win Rate" value={`${winRate}%`} />
              )}
            </div>
          )}
        </section>

        {/* Edit profile form */}
        <section style={styles.card}>
          <h3 style={styles.sectionTitle}>Edit Profile</h3>
          <form onSubmit={handleSave} noValidate style={styles.form}>
            <label style={styles.label} htmlFor="displayName">
              Display Name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              value={form.displayName}
              onChange={handleChange}
              maxLength={32}
              required
              style={styles.input}
              placeholder="Your display name"
            />

            <label style={styles.label} htmlFor="avatarUrl">
              Avatar URL
            </label>
            <input
              id="avatarUrl"
              name="avatarUrl"
              type="url"
              value={form.avatarUrl}
              onChange={handleChange}
              style={styles.input}
              placeholder="https://example.com/avatar.png"
            />

            {saveError && <p style={styles.errorText}>{saveError}</p>}

            <button
              type="submit"
              disabled={saveStatus === 'saving'}
              style={{
                ...styles.saveBtn,
                ...(saveStatus === 'saving' ? styles.saveBtnDisabled : {}),
              }}
            >
              {saveStatus === 'saving'
                ? 'Saving…'
                : saveStatus === 'saved'
                ? '✓ Saved'
                : 'Save Changes'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div style={styles.statBox}>
      <span style={{ ...styles.statValue, color: color ?? '#e2e8f0' }}>
        {value}
      </span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 2rem',
    height: '60px',
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#f8fafc',
  },
  nav: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  navBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '0.875rem',
    padding: '0.375rem 0.75rem',
    borderRadius: '6px',
  },
  navBtnActive: {
    backgroundColor: '#334155',
    color: '#f8fafc',
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid #475569',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '0.875rem',
    padding: '0.375rem 0.75rem',
    borderRadius: '6px',
  },
  main: {
    maxWidth: '720px',
    margin: '2rem auto',
    padding: '0 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '1.5rem',
    border: '1px solid #334155',
  },
  avatarWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #475569',
  },
  avatarPlaceholder: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    fontWeight: 700,
    color: '#94a3b8',
    flexShrink: 0,
  },
  identity: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  displayName: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#f8fafc',
  },
  email: {
    margin: 0,
    fontSize: '0.875rem',
    color: '#94a3b8',
  },
  eloBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    marginTop: '0.25rem',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '999px',
    padding: '0.125rem 0.625rem',
    width: 'fit-content',
  },
  eloLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  eloValue: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#f59e0b',
  },
  sectionTitle: {
    margin: '0 0 1rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#cbd5e1',
  },
  muted: {
    color: '#64748b',
    fontSize: '0.875rem',
  },
  errorText: {
    color: '#f87171',
    fontSize: '0.875rem',
    margin: '0.25rem 0',
  },
  statsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  statBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '0.75rem 1.25rem',
    minWidth: '80px',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginTop: '0.125rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginTop: '0.5rem',
  },
  input: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#e2e8f0',
    fontSize: '0.9rem',
    padding: '0.5rem 0.75rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  saveBtn: {
    marginTop: '1rem',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    padding: '0.625rem 1.25rem',
    alignSelf: 'flex-start',
  },
  saveBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};
