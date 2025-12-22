import Link from 'next/link';
// TODO: Create CSS Modules file for Landing page
// import styles from './Landing.module.css';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <div style={{ textAlign: 'center', color: 'white', maxWidth: '800px', width: '100%' }}>
        <div style={{ marginBottom: '50px' }}>
          <h1 style={{ fontSize: '4rem', fontWeight: 700, margin: '0 0 20px 0', textShadow: '2px 2px 4px rgba(0, 0, 0, 0.2)' }}>VideoMeet</h1>
          <p style={{ fontSize: '1.5rem', opacity: 0.9, margin: 0 }}>Connect with anyone, anywhere</p>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '60px' }}>
          <Link href="/signin" style={{ padding: '15px 40px', fontSize: '1.1rem', fontWeight: 600, border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'white', color: '#667eea', textDecoration: 'none' }}>
            Sign In
          </Link>
          <Link href="/signup" style={{ padding: '15px 40px', fontSize: '1.1rem', fontWeight: 600, border: '2px solid white', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'transparent', color: 'white', textDecoration: 'none' }}>
            Sign Up
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '30px', marginTop: '60px' }}>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '30px', borderRadius: '12px', backdropFilter: 'blur(10px)' }}>
            <h3>🎥 HD Video</h3>
            <p>Crystal clear video quality</p>
          </div>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '30px', borderRadius: '12px', backdropFilter: 'blur(10px)' }}>
            <h3>📺 Screen Share</h3>
            <p>Share your screen with audio</p>
          </div>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '30px', borderRadius: '12px', backdropFilter: 'blur(10px)' }}>
            <h3>🔗 Easy Links</h3>
            <p>Join with a simple link</p>
          </div>
        </div>
      </div>
    </div>
  );
}
