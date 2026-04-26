import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

/* ── AJO ZONES (hidden by default, activated by Adobe Journey Optimizer) ──
   Each zone has an id that AJO / Launch rules will target via DOM or JS.
   To activate in AJO: set element display to block / add class "ajo-active"
   ─────────────────────────────────────────────────────────────────────── */

const STATS = [
  { num: "20+", label: "Products Available" },
  { num: "100%", label: "Secure Checkout" },
  { num: "AEP", label: "Powered Tracking" },
];

const Home = () => {
  const navigate = useNavigate();
  const [showcaseProducts, setShowcaseProducts] = useState([]);
  const [promoVisible, setPromoVisible] = useState(true);
  const [exitOverlayOpen, setExitOverlayOpen] = useState(false);
  const exitFired = useRef(false);

  // Load 4 products for hero showcase
  useEffect(() => {
    axios
      .get("https://fakestoreapi.com/products?limit=4")
      .then((res) => setShowcaseProducts(res.data))
      .catch(() => {});
  }, []);

  // Exit-intent trigger
  // Rules:
  //   1. User must have been on page for at least 10 seconds
  //   2. Only fires ONCE per browser session (sessionStorage flag)
  //   3. Mouse must move above top edge of viewport (clientY <= 0)
  useEffect(() => {
    // If already shown this session, do not attach listener at all
    if (sessionStorage.getItem("exit_intent_shown")) return;

    const pageEntryTime = Date.now();
    const MIN_TIME_ON_PAGE_MS = 10000; // 10 seconds

    const handleMouseLeave = (e) => {
      if (e.clientY <= 0 && !exitFired.current) {
        const timeOnPage = Date.now() - pageEntryTime;
        if (timeOnPage < MIN_TIME_ON_PAGE_MS) return; // Too soon — ignore

        exitFired.current = true;
        sessionStorage.setItem("exit_intent_shown", "true"); // Never show again this session
        setExitOverlayOpen(true);

        if (window.dataLayer) {
          window.dataLayer.event = {
            name: "exit_intent",
            category: "ui",
            timestamp: Date.now(),
          };
        }
        if (window._satellite?.track) {
          window._satellite.track("aep_exit_intent");
        }
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, []);

  return (
    <div className="hero-wrapper">

      {/* ── AJO ZONE 1: TOP PROMO BAR ──────────────────────────────────── */}
      {/* id="ajo-promo-bar" → AJO targets this container for offers        */}
      {promoVisible && (
        <div
          className="ajo-promo-bar"
          id="ajo-promo-bar"
          data-ajo-zone="promo_bar"
          onClick={() => navigate("/products")}
        >
          ✨ New arrivals are live — <span>Free shipping on orders over $50</span> &nbsp;→ Shop Now
          <button
            className="close-promo"
            onClick={(e) => { e.stopPropagation(); setPromoVisible(false); }}
            aria-label="Close promo"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── AJO ZONE 2: HERO BANNER ────────────────────────────────────── */}
      {/* AJO sets this to ajo-active class to show a targeted hero message */}
      <div
        id="ajo-hero-banner"
        className="ajo-hero-banner"
        data-ajo-zone="hero_banner"
        aria-label="AJO Hero Banner Zone"
      >
        {/* AJO will inject personalized content here */}
        <p style={{ padding: "16px 20px", fontSize: "15px", color: "var(--charcoal)", fontWeight: "500" }}>
          🎯 <strong>AJO Hero Banner</strong> — This zone is reserved for Adobe Journey Optimizer personalized messages.
        </p>
      </div>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="hero">
        {/* Left: Text */}
        <div className="hero-text">
          <div className="hero-eyebrow">
            Built for AEP · CJA · AJO
          </div>

          <h1>
            Experience Modern <br />
            <span className="accent-word">eCommerce</span>,<br />
            Done Right
          </h1>

          <p className="hero-subtitle">
            A high-fidelity demo store showcasing real customer journeys,
            real commerce flows, and real-time personalization powered by
            Adobe Experience Platform.
          </p>

          <div className="hero-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate("/products")}
            >
              Explore Products →
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => navigate("/login")}
            >
              Sign In
            </button>
          </div>

          <div className="hero-stats">
            {STATS.map((s) => (
              <div className="hero-stat" key={s.num}>
                <span className="hero-stat-num">{s.num}</span>
                <span className="hero-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Product Showcase */}
        <div className="hero-visual">
          <div className="hero-floating-badge">
            <span className="badge-icon">⚡</span>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--navy)" }}>Live Tracking</div>
              <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: "400" }}>XDM events firing</div>
            </div>
          </div>

          <div className="hero-product-showcase">
            {showcaseProducts.length > 0
              ? showcaseProducts.map((p) => (
                  <div
                    key={p.id}
                    className="showcase-card"
                    onClick={() => navigate(`/product/${p.id}-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`)}
                  >
                    <img src={p.image} alt={p.title} />
                    <div className="showcase-card-name">{p.title.substring(0, 30)}…</div>
                    <div className="showcase-card-price">${p.price}</div>
                  </div>
                ))
              : [1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-img" style={{ height: "120px" }} />
                    <div className="skeleton-body">
                      <div className="skeleton-line short" />
                      <div className="skeleton-line" style={{ width: "40%" }} />
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </section>

      {/* ── VALUE PROPS SECTION ────────────────────────────────────────── */}
      <section className="value-section">
        <div className="section-header">
          <div className="section-label">Why This Demo</div>
          <h2 className="section-title">Built for Real AEP Demonstrations</h2>
          <p className="section-subtitle">
            Every interaction fires structured XDM-aligned events. Every page transition updates the data layer.
            Real identity stitching, real commerce flows.
          </p>
        </div>

        <div className="value-grid">
          {[
            {
              icon: "🛍️",
              title: "Real Commerce Flow",
              desc: "Product discovery, cart management, checkout, and purchase — complete commerce journey with every micro-interaction tracked.",
            },
            {
              icon: "🔐",
              title: "Real Identity",
              desc: "Guest-to-authenticated profile stitching done correctly. Email-based login updates the identity namespace in the data layer.",
            },
            {
              icon: "📊",
              title: "Real Data Layer",
              desc: "XDM-aligned window.dataLayer with page, user, commerce, product, and event contexts. Ready for Adobe Launch rules.",
            },
            {
              icon: "🎯",
              title: "AJO-Ready Zones",
              desc: "Pre-built personalization surfaces — hero banner, promo bar, cart upsell, and exit-intent overlay. Activate via Journey Optimizer.",
            },
            {
              icon: "⚡",
              title: "Web SDK Ready",
              desc: "Clean data layer schema maps directly to Web SDK sendEvent() calls. Launch rules read each event by name.",
            },
            {
              icon: "🔍",
              title: "CJA Compatible",
              desc: "Event timestamps, page contexts, and user IDs flow into Customer Journey Analytics for cross-channel analysis.",
            },
          ].map((card) => (
            <div className="value-card" key={card.title}>
              <div className="value-icon">{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── AJO ZONE 4: EXIT-INTENT OVERLAY ───────────────────────────── */}
      {/* id="ajo-exit-overlay" → AJO activates via class or JS injection  */}
      <div
        id="ajo-exit-overlay"
        className={`ajo-exit-overlay${exitOverlayOpen ? " ajo-active" : ""}`}
        data-ajo-zone="exit_intent_overlay"
        onClick={(e) => { if (e.target === e.currentTarget) setExitOverlayOpen(false); }}
      >
        <div className="ajo-exit-modal">
          <button
            className="close-btn"
            onClick={() => setExitOverlayOpen(false)}
            aria-label="Close"
          >
            ✕
          </button>

          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎯</div>

          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: "700", color: "var(--navy)", marginBottom: "10px", letterSpacing: "-0.5px" }}>
            Wait — before you go!
          </h2>

          <p style={{ fontSize: "14.5px", color: "var(--slate)", lineHeight: "1.65", marginBottom: "24px" }}>
            This overlay is an <strong>AJO Exit-Intent Zone</strong>. In production,
            Adobe Journey Optimizer would inject a personalized offer here based on
            your customer profile and browsing behavior.
          </p>

          <div
            style={{
              background: "var(--accent-light)",
              border: "1px solid rgba(255,107,53,0.2)",
              borderRadius: "var(--radius-md)",
              padding: "14px 18px",
              marginBottom: "24px",
              fontSize: "13px",
              color: "var(--charcoal)",
              textAlign: "left",
            }}
          >
            <strong>🔖 AJO Surface ID:</strong> <code>exit_intent_overlay</code><br />
            <strong>📡 Event fired:</strong> <code>exit_intent</code> → dataLayer
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              className="btn btn-primary"
              onClick={() => { setExitOverlayOpen(false); navigate("/products"); }}
            >
              Browse Products
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setExitOverlayOpen(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Home;