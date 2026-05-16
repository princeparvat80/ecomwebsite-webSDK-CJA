import React, { useState }              from "react";
import { useNavigate, useLocation }     from "react-router-dom";
import { useAuth }                      from "../auth/AuthContext";
import { pushLoginEvent }               from "../tracking/initDataLayer";

/*
  Login.js
  ─────────────────────────────────────────────────────────────
  Handles email-based sign-in. No password — this simulates
  identity stitching in AEP for demo purposes.
*/

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Login = () => {
  const { auth, login } = useAuth();
  const navigate        = useNavigate();
  const location        = useLocation();

  const [email,   setEmail]   = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  /* Redirect destination — comes from Cart's navigate("/login", { state: { from: "/checkout" } }) */
  const from = location.state?.from || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    /* Client-side email format validation */
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    /* Simulate brief async delay for realistic UX feel */
    await new Promise((resolve) => setTimeout(resolve, 600));

    try {
      /*
        STEP 1 — Write auth state to React + localStorage.
        login() in AuthContext stores the email and sets
        isAuthenticated: true in localStorage (ECOM_AUTH_USER).
        This MUST happen before pushLoginEvent() so that
        getCurrentIdentityMap() reads the correct auth state.
      */
      login(email);

      /*
        STEP 2 — Push login event to ACDL.
        This is the identity stitch push. It carries:
          identityMap.Email[0].id = email
          identityMap.Email[0].authenticatedState = "authenticated"

        When AEP Edge Network receives this push (via Launch + Web SDK):
          1. Reads ECID from Web SDK's first-party identity cookie
          2. Reads Email from identityMap in this push
          3. Sends both to RTCDP identity graph
          4. RTCDP merges anonymous ECID profile + known Email profile
          5. All pre-login events attributed to the known profile
          6. AJO can now find the profile and enroll in journeys

        This single push is what makes the entire RTCDP identity
        resolution work. Without it, every user is always anonymous.
      */
      pushLoginEvent(email);

      /*
        STEP 3 — Navigate to destination.
        PageTracker fires page_view for the destination page
        automatically via its useEffect on location.pathname change.
        That page_view will already carry the authenticated
        identityMap because getCurrentIdentityMap() now reads
        the email we just stored in localStorage in STEP 1.
      */
      navigate(from, { replace: true });

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  /* ── Already authenticated — show redirect options ── */
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

  /* ── Login form ── */
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
          Enter your email to sign in. This simulates real identity
          stitching in Adobe Experience Platform.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
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
              marginTop:    "20px",
              padding:      "14px",
              fontSize:     "15px",
              borderRadius: "var(--radius-md)",
              opacity:      loading ? 0.75 : 1,
              cursor:       loading ? "not-allowed" : "pointer",
            }}
            disabled={loading}
          >
            {loading ? (
              <span
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            "10px",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    width:           "16px",
                    height:          "16px",
                    border:          "2px solid rgba(255,255,255,0.3)",
                    borderTopColor:  "white",
                    borderRadius:    "50%",
                    animation:       "spin 0.7s linear infinite",
                    display:         "inline-block",
                  }}
                />
                Signing in…
              </span>
            ) : (
              "Sign In →"
            )}
          </button>
        </form>

        {/* AEP tracking note — updated to reflect ACDL architecture */}
        <div className="login-note">
          <div
            style={{
              background:   "var(--bg)",
              border:       "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding:      "12px 14px",
              fontSize:     "12px",
              color:        "var(--muted)",
              textAlign:    "left",
              marginTop:    "20px",
              lineHeight:   "1.6",
            }}
          >
            <strong style={{ color: "var(--charcoal)" }}>📡 AEP Identity:</strong>
            &nbsp;Signing in pushes a{" "}
            <code
              style={{
                fontSize:     "11px",
                background:   "rgba(255,107,53,0.1)",
                padding:      "2px 5px",
                borderRadius: "3px",
              }}
            >
              login
            </code>{" "}
            event to{" "}
            <code
              style={{
                fontSize:     "11px",
                background:   "rgba(255,107,53,0.1)",
                padding:      "2px 5px",
                borderRadius: "3px",
              }}
            >
              window.adobeDataLayer
            </code>{" "}
            with{" "}
            <code
              style={{
                fontSize:     "11px",
                background:   "rgba(255,107,53,0.1)",
                padding:      "2px 5px",
                borderRadius: "3px",
              }}
            >
              identityMap.Email
            </code>{" "}
            set to{" "}
            <code
              style={{
                fontSize:     "11px",
                background:   "rgba(255,107,53,0.1)",
                padding:      "2px 5px",
                borderRadius: "3px",
              }}
            >
              authenticated
            </code>
            . Launch reads this via the Adobe Client Data Layer
            extension and sends it to AEP Edge for RTCDP profile
            stitching.
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;