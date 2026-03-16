import { useState, type FormEvent } from 'react';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập email và mật khẩu');
      return;
    }

    setLoading(true);
    const result = await onLogin(email.trim(), password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Đăng nhập thất bại');
    }
  };

  return (
    <div className="popup-container">
      <div style={{ textAlign: 'center', paddingTop: 8, paddingBottom: 8 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>TBS ERP</h1>
        <p className="text-muted text-sm" style={{ marginTop: 4 }}>
          Đăng nhập để sử dụng extension
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="form-input"
            placeholder="email@company.vn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            type="password"
            className="form-input"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
