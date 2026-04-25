import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Login = () => {
  const { auth, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const from = location.state?.from || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    // Simulate brief async (for realistic UX)
    await new Promise((r) => setTimeout(r, 600));

    try {
      login(email);

      // Update AEP data layer user context on login
      if (window.dataLayer) {
        window.dataLayer.user = {
          isLoggedIn: true,
          loginState: "authenticated",
          authId: email,
          authNamespace: "email",
        };
        window.dataLayer.event = {
          name: "login",
          category: "identity",
          timestamp: Date.now(),
        };
        console.log("🔐 login event fired:", window.dataLayer);
        if (window._satellite?.track) {
          window._satellite.track("aep_login");
        }
      }

      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (auth.isAuthenticated) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "52px", marginBottom: "20px" }}>👋</div>
          <h2>Already Signed In</h2>
          <p className="login-desc">
            You're signed in as <strong>{auth.email}</strong>
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/products")}
            >
              Browse Products
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate("/cart")}
            >
              View Cart
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon" />
          <span className="login-logo-text">Prince AEP Lab</span>
        </div>

        <h2>Welcome back</h2>
        <p className="login-desc">
          Enter your email to sign in. This simulates real identity stitching in Adobe Experience Platform.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              autoComplete="email"
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <div className="form-error">
              <span>⚠️</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{
              marginTop: "20px",
              padding: "14px",
              fontSize: "15px",
              borderRadius: "var(--radius-md)",
              opacity: loading ? 0.75 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center" }}>
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                    display: "inline-block",
                  }}
                />
                Signing in…
              </span>
            ) : (
              "Sign In →"
            )}
          </button>
        </form>

        {/* AEP note */}
        <div className="login-note">
          <div
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              fontSize: "12px",
              color: "var(--muted)",
              textAlign: "left",
              marginTop: "20px",
              lineHeight: "1.6",
            }}
          >
            <strong style={{ color: "var(--charcoal)" }}>📡 AEP Identity:</strong>&nbsp;
            Signing in fires a{" "}
            <code style={{ fontSize: "11px", background: "rgba(255,107,53,0.1)", padding: "2px 5px", borderRadius: "3px" }}>login</code>{" "}
            event and sets{" "}
            <code style={{ fontSize: "11px", background: "rgba(255,107,53,0.1)", padding: "2px 5px", borderRadius: "3px" }}>dataLayer.user.authId</code>{" "}
            for identity stitching in AEP.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;