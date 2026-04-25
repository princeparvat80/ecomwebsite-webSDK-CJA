import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "../auth/AuthContext";

const Navbar = () => {
  const { auth, logout } = useAuth();
  const cartItems = useSelector((state) => state.cart.cartItems);
  const navigate = useNavigate();
  const location = useLocation();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = (e) => {
    e.preventDefault();
    logout();
    navigate("/");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav
      className="navbar"
      style={{
        boxShadow: scrolled
          ? "0 4px 24px rgba(0,0,0,0.08)"
          : "0 1px 0 rgba(0,0,0,0.04)",
      }}
    >
      {/* LOGO */}
      <div className="logo">
        <Link to="/">Prince AEP Lab</Link>
      </div>

      {/* DESKTOP NAV */}
      <ul className="nav-links" style={{ display: "flex" }}>
        <li>
          <Link
            to="/"
            className={isActive("/") ? "active" : ""}
          >
            Home
          </Link>
        </li>
        <li>
          <Link
            to="/products"
            className={isActive("/products") ? "active" : ""}
          >
            Products
          </Link>
        </li>
        <li>
          <Link
            to="/cart"
            className={`cart-link${isActive("/cart") ? " active" : ""}`}
          >
            <span className="cart-icon">🛒</span>
            Cart
            {cartCount > 0 && (
              <span className="cart-count">{cartCount}</span>
            )}
          </Link>
        </li>

        {!auth.isAuthenticated ? (
          <li>
            <Link to="/login" className="nav-auth-btn">
              Sign In
            </Link>
          </li>
        ) : (
          <li style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "13px",
                color: "var(--muted)",
                fontWeight: "500",
                maxWidth: "160px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              👋 {auth.email}
            </span>
            <Link to="/" className="nav-logout-btn" onClick={handleLogout}>
              Logout
            </Link>
          </li>
        )}
      </ul>

      {/* MOBILE HAMBURGER */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          display: "none",
          background: "none",
          border: "none",
          fontSize: "22px",
          cursor: "pointer",
          color: "var(--charcoal)",
          padding: "6px",
        }}
        className="mobile-menu-btn"
        aria-label="Toggle menu"
      >
        {mobileOpen ? "✕" : "☰"}
      </button>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div
          style={{
            position: "fixed",
            top: "68px",
            left: 0,
            right: 0,
            background: "white",
            borderBottom: "1px solid var(--border)",
            padding: "16px 20px 24px",
            zIndex: 999,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            animation: "slideDown 0.25s ease",
          }}
        >
          {[
            { to: "/", label: "Home" },
            { to: "/products", label: "Products" },
            { to: "/cart", label: `🛒 Cart${cartCount > 0 ? ` (${cartCount})` : ""}` },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              style={{
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                color: isActive(to) ? "var(--accent)" : "var(--charcoal)",
                background: isActive(to) ? "var(--accent-light)" : "transparent",
                fontWeight: "600",
                fontSize: "15px",
                textDecoration: "none",
              }}
            >
              {label}
            </Link>
          ))}

          {!auth.isAuthenticated ? (
            <Link
              to="/login"
              style={{
                marginTop: "8px",
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                background: "var(--navy)",
                color: "white",
                fontWeight: "600",
                fontSize: "15px",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Sign In
            </Link>
          ) : (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontSize: "13px", color: "var(--muted)", padding: "0 14px 8px" }}>
                Signed in as {auth.email}
              </p>
              <button
                onClick={handleLogout}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(239,68,68,0.08)",
                  color: "var(--danger)",
                  fontWeight: "600",
                  fontSize: "15px",
                  border: "1px solid rgba(239,68,68,0.2)",
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;