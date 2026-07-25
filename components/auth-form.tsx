'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

type AuthFormProps = { mode: 'login' | 'register' };

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const supabase = getSupabase();
      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (data.session) router.push('/dashboard');
        else setSuccess('Account created. Check your email to confirm your address, then sign in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push('/dashboard');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to continue.');
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === 'register';
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link href="/" className="logo"><span className="logo-mark">C</span>CanvasForge</Link>
        <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p>{isRegister ? 'Create and manage websites from one secure dashboard.' : 'Sign in to edit and export your websites.'}</p>
        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isRegister ? 'new-password' : 'current-password'} required />
          </div>
          {error && <div className="message-error">{error}</div>}
          {success && <div className="message-success">{success}</div>}
          <button className="button-primary" type="submit" disabled={busy}>{busy ? 'Working…' : isRegister ? 'Create account' : 'Sign in'}</button>
        </form>
        <div className="auth-footer">
          {isRegister ? <>Already have an account? <Link href="/login">Sign in</Link></> : <>Need an account? <Link href="/register">Register</Link></>}
        </div>
      </section>
    </main>
  );
}
