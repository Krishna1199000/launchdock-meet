'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSocket } from '@/lib/context/SocketContext';
// TODO: Create Auth.module.css and import styles

export default function SignIn() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const socket = useSocket();

    useEffect(() => {
        // Check if already logged in
        const userData = localStorage.getItem('user');
        if (userData) {
            router.push('/dashboard');
        }
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/signin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                router.push('/dashboard');
            } else {
                setError(data.message || 'Invalid credentials');
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '24px', backgroundColor: '#020617' }}>
            {/* Navbar */}
            <header
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    maxWidth: '1280px',
                    margin: '0 auto 48px',
                    padding: '24px 0',
                    color: 'rgb(248, 250, 252)',
                }}
            >
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none', color: 'inherit' }}>
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background:
                                'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.9), rgba(37,99,235,0.9))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 24px rgba(56,189,248,0.3)',
                        }}
                    >
                        <span style={{ fontSize: 22 }}>🚀</span>
                    </div>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.02em' }}>VideoDock</span>
                </Link>
                <Link
                    href="/signup"
                    style={{
                        padding: '10px 24px',
                        borderRadius: 999,
                        backgroundImage: 'linear-gradient(135deg, rgb(56,189,248), rgb(59,130,246))',
                        color: '#020617',
                        textDecoration: 'none',
                        fontSize: '0.95rem',
                        boxShadow: '0 8px 20px rgba(56,189,248,0.3)',
                    }}
                >
                    Sign Up
                </Link>
            </header>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="card-float" style={{ background: 'radial-gradient(circle at top, rgba(56,189,248,0.15), transparent 55%) #020617', padding: '40px', borderRadius: '18px', boxShadow: '0 24px 80px rgba(15,23,42,0.9)', maxWidth: '420px', width: '100%', border: '1px solid rgba(51,65,85,0.9)' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '10px', color: 'rgb(248,250,252)' }}>Sign In</h1>
                <p style={{ color: 'rgb(148,163,184)', marginBottom: '30px' }}>Welcome back to VideoDock</p>

                {error && <div style={{ backgroundColor: '#fee', color: '#c33', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>{error}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label htmlFor="email" style={{ fontWeight: 500, color: 'rgb(226,232,240)' }}>Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="Enter your email"
                            style={{ padding: '12px', border: '1px solid rgba(51,65,85,0.9)', borderRadius: '10px', fontSize: '1rem', backgroundColor: 'rgba(15,23,42,0.85)', color: 'rgb(226,232,240)' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label htmlFor="password" style={{ fontWeight: 500, color: 'rgb(226,232,240)' }}>Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Enter your password"
                            style={{ padding: '12px', border: '1px solid rgba(51,65,85,0.9)', borderRadius: '10px', fontSize: '1rem', backgroundColor: 'rgba(15,23,42,0.85)', color: 'rgb(226,232,240)' }}
                        />
                    </div>

                    <button 
                        type="submit" 
                        style={{ padding: '12px', fontSize: '1rem', fontWeight: 600, backgroundImage: 'linear-gradient(135deg, rgb(56,189,248), rgb(129,140,248))', color: '#020617', border: 'none', borderRadius: '999px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 18px 45px rgba(15,23,42,0.9)' }} 
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '20px', color: 'rgb(148,163,184)' }}>
                    Don&apos;t have an account? <Link href="/signup" style={{ color: 'rgb(56,189,248)', textDecoration: 'none' }}>Sign Up</Link>
                </p>
                <p style={{ textAlign: 'center', marginTop: '10px', color: 'rgb(148,163,184)' }}>
                    <Link href="/" style={{ color: 'rgb(56,189,248)', textDecoration: 'none' }}>Back to Home</Link>
                </p>
            </div>
        </div>
    );
}