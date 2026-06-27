import React, { useState, useEffect, useRef } from "react";
import { useNavigate }                         from "react-router-dom";
import axios                                   from "axios";
import { slugify }                             from "../utils/slugify";
import { pushExitIntentEvent }                 from "../tracking/initDataLayer";

const STATS = [
  { num: "20+", label: "Products Available"  },
  { num: "100%", label: "Secure Checkout"    },
  { num: "AEP",  label: "Powered Tracking"   },
];

const Home = () => {
  const navigate = useNavigate();
  const [showcaseProducts, setShowcaseProducts] = useState([]);
  const [promoVisible,     setPromoVisible]     = useState(true);
  const [exitOverlayOpen,  setExitOverlayOpen]  = useState(false);
  const exitFired = useRef(false);

  /* Load 4 products for hero showcase */
  useEffect(() => {
    axios
      .get("https://fakestoreapi.com/products?limit=4")
      .then((res) => setShowcaseProducts(res.data))
      .catch(() => {});
  }, []);

  /*
    Exit-intent trigger rules:
    1. User must have been on page for at least 10 seconds
    2. Fires ONCE per browser session (sessionStorage flag)
    3. Mouse must leave through the top edge (clientY <= 0)
  */
  useEffect(() => {
    if (sessionStorage.getItem("exit_intent_shown")) return;

    const pageEntryTime       = Date.now();
    const MIN_TIME_ON_PAGE_MS = 10_000;

    const handleMouseLeave = (e) => {
      if (e.clientY <= 0 && !exitFired.current) {
        if (Date.now() - pageEntryTime < MIN_TIME_ON_PAGE_MS) return;

        exitFired.current = true;
        sessionStorage.setItem("exit_intent_shown", "true");
        setExitOverlayOpen(true);

        pushExitIntentEvent();
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, []);

  return (
    <div className="hero-wrapper">

      {/* ── AJO ZONE 1: TOP PROMO BAR ── */}
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

      {/* ── AJO ZONE 2: HERO BANNER ── */}
      <div
        id="ajo-hero-banner"
        className="ajo-hero-banner"
        data-ajo-zone="hero_banner"
        aria-label="AJO Hero Banner Zone"
      >
        <p style={{ padding: "16px 20px", fontSize: "15px", color: "var(--slate)", fontWeight: "500" }}>
          🎯 <strong>AJO Hero Banner</strong> — Reserved for Adobe Journey Optimizer personalized messages.
        </p>
      </div>

      {/* ── HERO ── */}
      <section className="hero">

        {/* Left: Text */}
        <div className="hero-text">
          <div className="hero-eyebrow">Built for AEP · CJA · AJO</div>

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
                    onClick={() => navigate(`/product/${slugify(p.id, p.title)}`)}
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

      {/* ── VALUE PROPS SECTION ── */}
      <section className="value-section">
        <div className="section-header">
          <div className="section-label">Why This Demo</div>
          <h2 className="section-title">Built for Real AEP Demonstrations</h2>
          <p className="section-subtitle">
            Every interaction pushes a structured XDM-aligned event to the
            Adobe Client Data Layer. Every page transition fires a page_view.
            Real identity stitching, real commerce flows.
          </p>
        </div>

        <div className="value-grid">
          {[
            {
              icon:  "🛍️",
              title: "Real Commerce Flow",
              desc:  "Product discovery, cart management, checkout, and purchase — complete commerce journey with every micro-interaction tracked.",
            },
            {
              icon:  "🔐",
              title: "Real Identity",
              desc:  "Guest-to-authenticated profile stitching via identityMap. Login push sets authenticatedState so RTCDP merges ECID and Email profiles.",
            },
            {
              icon:  "📊",
              title: "Adobe Client Data Layer",
              desc:  "ACDL push pattern — window.adobeDataLayer. Every event is immutable, timestamped in ISO 8601, and carries eventType for XDM schema compliance.",
            },
            {
              icon:  "🎯",
              title: "AJO-Ready Zones",
              desc:  "Pre-built personalization surfaces — hero banner, promo bar, cart upsell, and exit-intent overlay. Activate via Journey Optimizer.",
            },
            {
              icon:  "⚡",
              title: "Web SDK Ready",
              desc:  "ACDL pushes are read by the Adobe Client Data Layer Launch extension. Launch maps them to XDM and calls Web SDK sendEvent() — zero app code coupling.",
            },
            {
              icon:  "🔍",
              title: "CJA Compatible",
              desc:  "sessionId, pageCategory, UTM params, and ISO timestamps flow into Customer Journey Analytics for session-level funnel and acquisition analysis.",
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

      {/* ── AJO ZONE 4: EXIT-INTENT OVERLAY ── */}
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
              background:   "var(--accent-light)",
              border:       "1px solid rgba(255,107,53,0.2)",
              borderRadius: "var(--radius-md)",
              padding:      "14px 18px",
              marginBottom: "24px",
              fontSize:     "13px",
              color:        "var(--slate)",
              textAlign:    "left",
            }}
          >
            <strong>🔖 AJO Surface ID:</strong> <code>exit_intent_overlay</code><br />
            <strong>📡 Event pushed:</strong>{" "}
            <code>exit_intent</code> → <code>window.adobeDataLayer</code>
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