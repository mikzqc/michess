import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { useToast } from './Toast';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const [showPassword, setShowPassword] = useState(false);

  const getHumanErrorMessage = (errMessage: string) => {
    const lower = errMessage.toLowerCase();
    if (lower.includes('rate limit')) return "Too many attempts. Please try again later.";
    if (lower.includes('invalid login')) return "Incorrect email or password.";
    if (lower.includes('already registered')) return "An account with this email already exists.";
    if (lower.includes('password should be')) return "Password must be at least 6 characters.";
    if (lower.includes('networkerror') || lower.includes('failed to fetch')) return "Network Error: Please disable your Adblocker / Brave Shields, or check your internet connection.";
    return errMessage;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Backend is not configured.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isForgotPassword) {
        if (!email) throw new Error('Please enter your email address');
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        addToast('Password reset email sent!', 'success');
        setIsForgotPassword(false);
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else {
        if (!username || username.trim().length < 3) {
          throw new Error('Username must be at least 3 characters');
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim()
            }
          }
        });
        if (error) throw error;
        addToast('Sign up successful! Please check your email to verify.', 'success');
        onClose();
      }
    } catch (err: any) {
      setError(getHumanErrorMessage(err.message || 'Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isForgotPassword ? 'Reset Password' : (isLogin ? 'Log In' : 'Sign Up')} maxWidth="md">
      <div className="p-5">
        {error && (
        <div className="mb-6 p-4 bg-error/20 border border-error/50 rounded-lg text-error flex items-start gap-3">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input 
          label="Email"
          type="email" 
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          disabled={loading}
          icon={<Mail size={18} />}
          placeholder="you@example.com"
        />

        {!isForgotPassword && !isLogin && (
          <Input 
            label="Username"
            type="text" 
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            disabled={loading}
            placeholder="Choose a username"
            minLength={3}
            maxLength={20}
          />
        )}

        {!isForgotPassword && (
          <div className="relative">
            <Input 
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
              icon={<Lock size={18} />}
              placeholder="••••••••"
            />
            <button 
              type="button"
              className="absolute right-3 top-9 text-content-3 hover:text-content-1 transition-colors"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
        )}

        {isLogin && !isForgotPassword && (
          <div className="flex justify-end -mt-3">
            <button
              type="button"
              onClick={() => { setIsForgotPassword(true); setError(null); }}
              className="text-xs text-accent hover:text-accent-hover font-medium transition-colors"
            >
              Forgot password?
            </button>
          </div>
        )}

        <Button 
          type="submit" 
          disabled={loading}
          fullWidth
          className="mt-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (isForgotPassword ? 'Send Reset Link' : (isLogin ? 'Log In' : 'Create Account'))}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-content-3">
        {isForgotPassword ? (
          <button 
            type="button"
            onClick={() => { setIsForgotPassword(false); setError(null); }}
            className="text-accent hover:text-accent-hover font-bold transition-colors"
          >
            Back to log in
          </button>
        ) : (
          <>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="text-accent hover:text-accent-hover font-bold transition-colors"
            >
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </>
        )}
      </div>
      </div>
    </Modal>
  );
};
