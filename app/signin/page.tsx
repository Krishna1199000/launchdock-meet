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
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
            <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '10px', color: '#333' }}>Sign In</h1>
                <p style={{ color: '#666', marginBottom: '30px' }}>Welcome back to VideoMeet</p>

                {error && <div style={{ backgroundColor: '#fee', color: '#c33', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>{error}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label htmlFor="email" style={{ fontWeight: 500, color: '#333' }}>Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="Enter your email"
                            style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label htmlFor="password" style={{ fontWeight: 500, color: '#333' }}>Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Enter your password"
                            style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem' }}
                        />
                    </div>

                    <button 
                        type="submit" 
                        style={{ padding: '12px', fontSize: '1rem', fontWeight: 600, backgroundColor: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }} 
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>
                    Don&apos;t have an account? <Link href="/signup" style={{ color: '#667eea', textDecoration: 'none' }}>Sign Up</Link>
                </p>
                <p style={{ textAlign: 'center', marginTop: '10px', color: '#666' }}>
                    <Link href="/" style={{ color: '#667eea', textDecoration: 'none' }}>Back to Home</Link>
                </p>
            </div>
        </div>
    );
}