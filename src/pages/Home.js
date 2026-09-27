import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link }                  from "react-router-dom";
import { useDispatch, useSelector }           from "react-redux";
import axios                                  from "axios";
import { toast }                              from "react-toastify";
import { addToCart }                          from "../redux/cartSlice";
import { slugify }                            from "../utils/slugify";
import { pushAddToCartEvent, pushExitIntentEvent } from "../tracking/initDataLayer";

/* Friendly labels for the fakestoreapi categories */
const CATEGORY_META = [
  { key: "electronics",     label: "Electronics",     blurb: "Gadgets & gear" },
  { key: "jewelery",        label: "Jewelry",         blurb: "Shine every day" },
  { key: "men's clothing",  label: "Men's Fashion",   blurb: "Sharp & casual" },
  { key: "women's clothing", label: "Women's Fashion", blurb: "Style that fits" },
];

const StarRating = ({ rating }) => {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="stars-display">
      {Array.from({ length: full  }).map((_, i) => <span key={"f" + i} className="star filled">&#9733;</span>)}
      {half  && <span className="star half">&#9733;</span>}
      {Array.from({ length: empty }).map((_, i) => <span key={"e" + i} className="star">&#9734;</span>)}
    </span>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const cart     = useSelector((state) => state.cart);

  const [products,        setProducts]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [promoVisible,    setPromoVisible]    = useState(true);
  const [exitOverlayOpen, setExitOverlayOpen] = useState(false);
  const [email,           setEmail]           = useState("");
  const exitFired = useRef(false);

  /* Load the full catalog for the storefront sections */
  useEffect(() => {
    axios
      .get("https://fakestoreapi.com/products")
      .then((res) => { setProducts(res.data); setLoading(false); })
      .catch(() => setLoading(false));
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

  /*
    Add to cart. Mirrors the exact contract used on the Products page:
    compute the post-add items array, dispatch, then push the ACDL event
    with the updated cart so productListItems reflects the state after add.
  */
  const handleAddToCart = (product) => {
    const existingItem = cart.cartItems.find((ci) => ci.id === product.id);
    const updatedItems = existingItem
      ? cart.cartItems.map((ci) =>
          ci.id === product.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        )
      : [...cart.cartItems, { ...product, quantity: 1 }];

    dispatch(addToCart(product));
    pushAddToCartEvent({ product, cart: { items: updatedItems } });

    toast.success("Added to cart", {
      position: "top-right", autoClose: 2000, hideProgressBar: false,
      closeOnClick: true, pauseOnHover: false, draggable: true,
    });
  };

  const goToCategory = (key) => navigate("/products", { state: { category: key } });

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    setEmail("");
    toast.success("You are subscribed. Watch your inbox for offers.", {
      position: "top-right", autoClose: 2500,
    });
  };

  /* Derived storefront data */
  const heroImage = products.find((p) => p.category === "electronics")?.image
    || products[0]?.image;
  const categoryImages = CATEGORY_META.map((c) => ({
    ...c,
    image: products.find((p) => p.category === c.key)?.image,
  }));
  const trending = products.slice(0, 8);
  const deals    = products.slice(8, 12);

  return (
    <div className="store">

      {/* AJO ZONE 1: TOP PROMO BAR */}
      {promoVisible && (
        <div
          className="ajo-promo-bar"
          id="ajo-promo-bar"
          data-ajo-zone="promo_bar"
          onClick={() => navigate("/products")}
        >
          <span className="promo-spark">✨</span>
          Mid-season sale is on. <span>Free shipping over $50.</span>
          <span className="promo-cta">Shop now</span>
          <button
            className="close-promo"
            onClick={(e) => { e.stopPropagation(); setPromoVisible(false); }}
            aria-label="Close promo"
          >
            ✕
          </button>
        </div>
      )}

      {/* AJO ZONE 2: HERO BANNER (hidden until Journey Optimizer activates it) */}
      <div
        id="ajo-hero-banner"
        className="ajo-hero-banner"
        data-ajo-zone="hero_banner"
        aria-label="AJO Hero Banner Zone"
      >
        <p style={{ padding: "16px 20px", fontSize: "15px", color: "var(--slate)", fontWeight: "500" }}>
          Reserved for a personalized message from Adobe Journey Optimizer.
        </p>
      </div>

      {/* HERO / SALE BANNER */}
      <section className="store-hero">
        <div className="store-hero-text">
          <span className="store-hero-tag">Mid-Season Sale</span>
          <h1>
            Up to <span className="accent-word">50% off</span><br />
            everything you love
          </h1>
          <p>
            Thousands of products across electronics, fashion and jewelry.
            Fresh drops every week, delivered fast to your door.
          </p>
          <div className="store-hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate("/products")}>
              Shop all products
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => goToCategory("electronics")}>
              Browse electronics
            </button>
          </div>
          <div className="store-hero-trust">
            <span>Free shipping over $50</span>
            <span className="dot-sep" />
            <span>Easy 30 day returns</span>
            <span className="dot-sep" />
            <span>Secure checkout</span>
          </div>
        </div>

        <div className="store-hero-media">
          <div className="store-hero-discount">
            <strong>50%</strong>
            <span>OFF</span>
          </div>
          {heroImage
            ? <img src={heroImage} alt="Featured product" className="store-hero-img" />
            : <div className="store-hero-img skeleton-img" style={{ borderRadius: "var(--radius-xl)" }} />}
          <div className="store-hero-glass">
            <span className="live-badge-dot" />
            Trending right now
          </div>
        </div>
      </section>

      {/* SHOP BY CATEGORY */}
      <section className="store-section">
        <div className="store-section-head">
          <h2>Shop by category</h2>
          <button className="link-btn" onClick={() => navigate("/products")}>View all</button>
        </div>
        <div className="cat-grid">
          {categoryImages.map((c) => (
            <button className="cat-tile" key={c.key} onClick={() => goToCategory(c.key)}>
              <div className="cat-tile-media">
                {c.image
                  ? <img src={c.image} alt={c.label} loading="lazy" />
                  : <div className="skeleton-img" style={{ height: "100%" }} />}
              </div>
              <div className="cat-tile-body">
                <div className="cat-tile-name">{c.label}</div>
                <div className="cat-tile-blurb">{c.blurb}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* PROMO CARDS */}
      <section className="store-section">
        <div className="promo-cards">
          <div className="promo-card promo-card-dark" onClick={() => navigate("/products")}>
            <div className="promo-card-kicker">New arrivals</div>
            <h3>The latest drops are here</h3>
            <p>Be first to shop this week's fresh additions.</p>
            <span className="promo-card-link">Discover now</span>
          </div>
          <div className="promo-card promo-card-accent" onClick={() => goToCategory("jewelery")}>
            <div className="promo-card-kicker">Members save more</div>
            <h3>Extra 20% off jewelry</h3>
            <p>Sign in to unlock member pricing at checkout.</p>
            <span className="promo-card-link">Shop jewelry</span>
          </div>
        </div>
      </section>

      {/* TRENDING PRODUCTS */}
      <section className="store-section">
        <div className="store-section-head">
          <h2>Trending this week</h2>
          <button className="link-btn" onClick={() => navigate("/products")}>See everything</button>
        </div>

        <div className="store-product-grid">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-img" style={{ height: "200px" }} />
                  <div className="skeleton-body">
                    <div className="skeleton-line short" style={{ marginBottom: "8px" }} />
                    <div className="skeleton-line medium" style={{ marginBottom: "8px" }} />
                    <div className="skeleton-line" style={{ width: "40%", height: "18px" }} />
                  </div>
                </div>
              ))
            : trending.map((product, index) => (
                <div key={product.id} className="product-card" style={{ animationDelay: `${(index % 8) * 0.05}s` }}>
                  <div className="product-card-image-wrap">
                    {index < 3 && <span className="product-badge badge-new">New</span>}
                    <button className="wishlist-btn" aria-label="Add to wishlist">♡</button>
                    <img
                      src={product.image}
                      alt={product.title}
                      className="product-image"
                      loading="lazy"
                      onClick={() => navigate(`/product/${slugify(product.id, product.title)}`)}
                    />
                    <div className="product-card-overlay">
                      <span>Quick view</span>
                    </div>
                  </div>
                  <div className="product-card-body">
                    <div className="product-category">{product.category}</div>
                    <h3>{product.title}</h3>
                    {product.rating && (
                      <div className="product-rating">
                        <StarRating rating={product.rating.rate} />
                        <span className="rating-count">({product.rating.count})</span>
                      </div>
                    )}
                    <div className="product-price-row">
                      <span className="price">${product.price}</span>
                    </div>
                    <div className="product-buttons">
                      <button onClick={() => handleAddToCart(product)} className="add-to-cart-button">
                        Add to cart
                      </button>
                      <Link to={`/product/${slugify(product.id, product.title)}`} className="details-button">
                        Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
        </div>
      </section>

      {/* DEALS OF THE DAY */}
      {!loading && deals.length > 0 && (
        <section className="store-section">
          <div className="deals-band">
            <div className="deals-band-head">
              <div>
                <div className="deals-kicker">Deals of the day</div>
                <h2>Limited time, limited stock</h2>
              </div>
              <button className="btn btn-secondary" onClick={() => navigate("/products")}>
                View all deals
              </button>
            </div>
            <div className="deals-grid">
              {deals.map((product) => {
                const original = (product.price * 1.4).toFixed(2);
                return (
                  <div
                    key={product.id}
                    className="deal-card"
                    onClick={() => navigate(`/product/${slugify(product.id, product.title)}`)}
                  >
                    <div className="deal-card-media">
                      <span className="deal-off">40% off</span>
                      <img src={product.image} alt={product.title} loading="lazy" />
                    </div>
                    <div className="deal-card-name">{product.title}</div>
                    <div className="deal-card-prices">
                      <span className="deal-now">${product.price}</span>
                      <span className="deal-was">${original}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* TRUST STRIP */}
      <section className="trust-strip">
        <div className="trust-item">
          <span className="trust-ic">🚚</span>
          <div><strong>Free shipping</strong><span>On orders over $50</span></div>
        </div>
        <div className="trust-item">
          <span className="trust-ic">↩️</span>
          <div><strong>Easy returns</strong><span>30 day money back</span></div>
        </div>
        <div className="trust-item">
          <span className="trust-ic">🔒</span>
          <div><strong>Secure payments</strong><span>Encrypted checkout</span></div>
        </div>
        <div className="trust-item">
          <span className="trust-ic">💬</span>
          <div><strong>24/7 support</strong><span>Here whenever you need</span></div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="newsletter-band">
        <div className="newsletter-inner">
          <div>
            <h2>Get 10% off your first order</h2>
            <p>Join our list for early access to sales, new arrivals and members only offers.</p>
          </div>
          <form className="newsletter-form" onSubmit={handleSubscribe}>
            <input
              type="email"
              className="newsletter-input"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address"
            />
            <button type="submit" className="btn btn-primary">Subscribe</button>
          </form>
        </div>
      </section>

      {/* AJO ZONE 4: EXIT-INTENT OVERLAY */}
      <div
        id="ajo-exit-overlay"
        className={`ajo-exit-overlay${exitOverlayOpen ? " ajo-active" : ""}`}
        data-ajo-zone="exit_intent_overlay"
        onClick={(e) => { if (e.target === e.currentTarget) setExitOverlayOpen(false); }}
      >
        <div className="ajo-exit-modal">
          <button className="close-btn" onClick={() => setExitOverlayOpen(false)} aria-label="Close">✕</button>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎁</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: "700", color: "var(--navy)", marginBottom: "10px", letterSpacing: "-0.5px" }}>
            Wait, here is 10% off
          </h2>
          <p style={{ fontSize: "15px", color: "var(--slate)", lineHeight: "1.65", marginBottom: "24px" }}>
            Before you go, take an extra 10% off your first order today. Use it at
            checkout on anything in the store.
          </p>
          <div className="exit-code">Use code <strong>WELCOME10</strong></div>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px" }}>
            <button className="btn btn-primary" onClick={() => { setExitOverlayOpen(false); navigate("/products"); }}>
              Shop now
            </button>
            <button className="btn btn-ghost" onClick={() => setExitOverlayOpen(false)}>
              No thanks
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Home;
