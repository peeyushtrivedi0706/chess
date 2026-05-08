import React, { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

interface RegisterFormState {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function validate(values: RegisterFormState): FormErrors {
  const errors: FormErrors = {};

  if (!values.displayName.trim()) {
    errors.displayName = 'Display name is required.';
  } else if (values.displayName.trim().length < 2) {
    errors.displayName = 'Display name must be at least 2 characters.';
  } else if (values.displayName.trim().length > 30) {
    errors.displayName = 'Display name must be 30 characters or fewer.';
  }

  if (!values.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  } else if (!PASSWORD_REGEX.test(values.password)) {
    errors.password =
      'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterFormState>({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      await api.post('/auth/register', {
        displayName: form.displayName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      setSuccessMessage('Account created! Redirecting to login…');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Registration failed. Please try again.';
      setErrors({ general: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>♟ Chess Portal</h1>
        <h2 style={styles.subtitle}>Create Account</h2>

        {successMessage && (
          <div role="status" style={styles.alertSuccess}>
            {successMessage}
          </div>
        )}

        {errors.general && (
          <div role="alert" style={styles.alertError}>
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={styles.form}>
          {([
            { id: 'displayName', label: 'Display Name', type: 'text', autoComplete: 'nickname' },
            { id: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
            { id: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
            { id: 'confirmPassword', label: 'Confirm Password', type: 'password', autoComplete: 'new-password' },
          ] as const).map(({ id, label, type, autoComplete }) => (
            <div key={id} style={styles.fieldGroup}>
              <label htmlFor={id} style={styles.label}>
                {label}
              </label>
              <input
                id={id}
                name={id}
                type={type}
                autoComplete={autoComplete}
                value={form[id]}
                onChange={handleChange}
                aria-invalid={!!errors[id]}
                aria-describedby={errors[id] ? `${id}-error` : undefined}
                style={{
                  ...styles.input,
                  ...(errors[id] ? styles.inputError : {}),
                }}
                disabled={loading || !!successMessage}
              />
              {errors[id] && (
                <span id={`${id}-error`} role="alert" style={styles.fieldError}>
                  {errors[id]}
                </span>
              )}
            </div>
          ))}

          <button type="submit" disabled={loading || !!successMessage} style={styles.button}>
            {loading ? 'Creating account…' : 'Register'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.link}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1a1a2e',
    padding: '1rem',
  },
  card: {
    background: '#16213e',
    borderRadius: '12px',
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  title: {
    color: '#e2b96f',
    textAlign: 'center',
    marginBottom: '0.25rem',
    fontSize: '1.8rem',
  },
  subtitle: {
    color: '#c8d6e5',
    textAlign: 'center',
    marginBottom: '1.5rem',
    fontWeight: 400,
    fontSize: '1.1rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    color: '#a0aec0',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  input: {
    padding: '0.65rem 0.85rem',
    borderRadius: '6px',
    border: '1px solid #2d3748',
    background: '#0f3460',
    color: '#e2e8f0',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  inputError: {
    borderColor: '#fc8181',
  },
  fieldError: {
    color: '#fc8181',
    fontSize: '0.8rem',
  },
  alertError: {
    background: '#742a2a',
    color: '#fed7d7',
    borderRadius: '6px',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    fontSize: '0.9rem',
  },
  alertSuccess: {
    background: '#1c4532',
    color: '#c6f6d5',
    borderRadius: '6px',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    fontSize: '0.9rem',
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.75rem',
    borderRadius: '6px',
    border: 'none',
    background: '#e2b96f',
    color: '#1a1a2e',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  footer: {
    marginTop: '1.5rem',
    textAlign: 'center',
    color: '#a0aec0',
    fontSize: '0.9rem',
  },
  link: {
    color: '#e2b96f',
    textDecoration: 'none',
    fontWeight: 600,
  },
};
