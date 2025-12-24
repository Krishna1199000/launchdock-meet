import Link from 'next/link';

export default function Home() {
  return (
    <div
      className="page-fade-in"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 32px',
      }}
    >
      {/* Top nav with logo (LaunchDock-like) */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '1280px',
          margin: '0 auto 80px',
          padding: '24px 0',
          color: 'rgb(248, 250, 252)',
          columnGap: '64px',
          rowGap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background:
                'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.9), rgba(37,99,235,0.9))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 18px 45px rgba(15,23,42,0.8)',
            }}
          >
            <span style={{ fontSize: 24 }}>🚀</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
                lineHeight: 1.2,
              }}
            >
              VideoDock
            </span>
            <span
              style={{
                fontSize: '0.8rem',
                color: 'rgb(148, 163, 184)',
                lineHeight: 1.2,
              }}
            >
              Video experiences for modern teams
            </span>
          </div>
        </div>

        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '48px',
            fontSize: '0.95rem',
            color: 'rgb(148, 163, 184)',
          }}
        >
          <Link
            href="#features"
            style={{
              color: 'rgb(226, 232, 240)',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Features
          </Link>
          <Link
            href="#pricing"
            style={{
              color: 'rgb(226, 232, 240)',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Pricing
          </Link>
          <Link
            href="#resources"
            style={{
              color: 'rgb(226, 232, 240)',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Resources
          </Link>
          <Link
            href="/signin"
            style={{
              padding: '10px 24px',
              borderRadius: 999,
              border: '1px solid rgba(148,163,184,0.4)',
              backgroundColor: 'rgba(15,23,42,0.6)',
              color: 'rgb(226, 232, 240)',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            style={{
              padding: '10px 24px',
              borderRadius: 999,
              backgroundImage: 'linear-gradient(135deg, rgb(56,189,248), rgb(59,130,246))',
              color: '#020617',
              textDecoration: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(56,189,248,0.3)',
            }}
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 48,
        }}
      >
        <div
          className="hero-slide-up"
          style={{
            textAlign: 'center',
            color: 'rgb(226, 232, 240)',
            maxWidth: '960px',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 14px',
              borderRadius: 999,
              border: '1px solid rgba(148,163,184,0.4)',
              backgroundColor: 'rgba(15,23,42,0.75)',
              color: 'rgb(148,163,184)',
              fontSize: '0.8rem',
              marginBottom: 24,
              gap: 8,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: 'rgb(56, 189, 248)',
              }}
            />
            Trusted for high-quality video collaboration
          </div>

          <h1
            style={{
              fontSize: '3.6rem',
              lineHeight: 1.1,
              fontWeight: 800,
              marginBottom: 16,
              color: 'rgb(248, 250, 252)',
            }}
          >
            We Build{' '}
            <span
              style={{
                backgroundImage:
                  'linear-gradient(120deg, rgb(56,189,248), rgb(129,140,248), rgb(244,114,182))',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Digital Meetings
            </span>
          </h1>

          <p
            style={{
              fontSize: '1.05rem',
              maxWidth: 560,
              margin: '0 auto 36px',
              color: 'rgb(148, 163, 184)',
            }}
          >
            VideoDock is your creative partner for stunning, reliable video calls,
            powerful collaboration, and digital meeting rooms that feel effortless.
          </p>

          <div
            style={{
              display: 'flex',
              gap: 16,
              justifyContent: 'center',
              marginBottom: 56,
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/signup"
              style={{
                padding: '14px 28px',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 999,
                cursor: 'pointer',
                backgroundImage:
                  'linear-gradient(135deg, rgb(56,189,248), rgb(59,130,246))',
                color: '#020617',
                boxShadow: '0 18px 45px rgba(15,23,42,0.8)',
              }}
            >
              Get Started
            </Link>
            <Link
              href="/signin"
              style={{
                padding: '14px 28px',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 999,
                cursor: 'pointer',
                border: '1px solid rgba(148,163,184,0.5)',
                backgroundColor: 'rgba(15,23,42,0.85)',
                color: 'rgb(226,232,240)',
              }}
            >
              Watch Demo
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 24,
              marginTop: 24,
            }}
          >
            <div
              className="card-float"
              style={{
                background:
                  'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.9))',
                borderRadius: 18,
                padding: 24,
                border: '1px solid rgba(51,65,85,0.9)',
                boxShadow: '0 18px 40px rgba(15,23,42,0.9)',
                textAlign: 'left',
              }}
            >
              <h3 style={{ marginBottom: 8, fontSize: '1rem' }}>🎥 HD Video</h3>
              <p style={{ fontSize: '0.9rem', color: 'rgb(148,163,184)' }}>
                Crystal clear video quality that keeps your team present and engaged.
              </p>
            </div>
            <div
              className="card-float"
              style={{
                background:
                  'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.9))',
                borderRadius: 18,
                padding: 24,
                border: '1px solid rgba(51,65,85,0.9)',
                boxShadow: '0 18px 40px rgba(15,23,42,0.9)',
                textAlign: 'left',
              }}
            >
              <h3 style={{ marginBottom: 8, fontSize: '1rem' }}>📺 Screen Share</h3>
              <p style={{ fontSize: '0.9rem', color: 'rgb(148,163,184)' }}>
                Share your screen and content with zero friction and full clarity.
              </p>
            </div>
            <div
              className="card-float"
              style={{
                background:
                  'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.9))',
                borderRadius: 18,
                padding: 24,
                border: '1px solid rgba(51,65,85,0.9)',
                boxShadow: '0 18px 40px rgba(15,23,42,0.9)',
                textAlign: 'left',
              }}
            >
              <h3 style={{ marginBottom: 8, fontSize: '1rem' }}>🔗 Easy Links</h3>
              <p style={{ fontSize: '0.9rem', color: 'rgb(148,163,184)' }}>
                Create shareable meeting links in seconds—no downloads, no hassle.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
