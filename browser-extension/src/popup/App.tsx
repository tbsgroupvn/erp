import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/LoginForm';
import { Cart } from './components/Cart';

export function App() {
  const { isAuthenticated, user, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="popup-container" style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />;
  }

  return <Cart user={user} onLogout={logout} />;
}
