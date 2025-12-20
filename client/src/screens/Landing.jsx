import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

const Landing = () => {
    const navigate = useNavigate();

    return (
        <div className="landing-container">
            <div className="landing-content">
                <div className="landing-header">
                    <h1 className="landing-title">VideoMeet</h1>
                    <p className="landing-subtitle">Connect with anyone, anywhere</p>
                </div>
                
                <div className="landing-actions">
                    <button 
                        className="btn-primary"
                        onClick={() => navigate('/signin')}
                    >
                        Sign In
                    </button>
                    <button 
                        className="btn-secondary"
                        onClick={() => navigate('/signup')}
                    >
                        Sign Up
                    </button>
                </div>

                <div className="landing-features">
                    <div className="feature-card">
                        <h3>🎥 HD Video</h3>
                        <p>Crystal clear video quality</p>
                    </div>
                    <div className="feature-card">
                        <h3>📺 Screen Share</h3>
                        <p>Share your screen with audio</p>
                    </div>
                    <div className="feature-card">
                        <h3>🔗 Easy Links</h3>
                        <p>Join with a simple link</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Landing;




