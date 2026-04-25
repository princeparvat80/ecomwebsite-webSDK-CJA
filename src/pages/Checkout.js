import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { clearCart } from "../redux/cartSlice";
import { useAuth } from "../auth/AuthContext";
import {
  pushBeginCheckoutEvent,
  pushPurchaseEvent,
} from "../tracking/initDataLayer";

const Checkout = () => {
  const { auth } = useAuth();
  const cartItems = useSelector((state) => state.cart.cartItems);
  const cart = useSelector((state) => state.cart);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Hard auth guard
  useEffect(() => {
    if (!auth.isAuthenticated) {
      navigate("/login", { state: { from: "/checkout" } });
    }
  }, [auth, navigate]);

  // Fire begin_checkout once on load (after auth confirmed)
  useEffect(() => {
    if (auth.isAuthenticated) {
      pushBeginCheckoutEvent(cart);
    }
    // eslint-disable-next-line
  }, [auth.isAuthenticated]);

  // Compute totals safely
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const shipping = subtotal > 50 ? 0 : 4.99;
  const total = subtotal + shipping;

  const handlePayment = () => {
    const orderId = `ORDER-${Date.now()}`;

    // Fire purchase BEFORE clearing cart
    pushPurchaseEvent({ cart, orderId });

    dispatch(clearCart());
    navigate("/confirmation", { state: { orderId, total } });
  };

  // Prevent flicker while auth redirect happens
  if (!auth.isAuthenticated) return null;

  return (
    <div className="checkout-container">
      {/* HEADER */}
      <h1 className="checkout-title">Checkout</h1>
      <p className="checkout-subtitle">
        Signed in as <strong>{auth.email}</strong>
      </p>

      {cartItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: "60px", marginBottom: "20px" }}>🛒</div>
          <h3 style={{ fontFamily: "var(--font-display)", color: "var(--navy)", marginBottom: "10px" }}>
            Your cart is empty
          </h3>
          <Link to="/products" className="btn btn-primary" style={{ marginTop: "12px", display: "inline-flex" }}>
            Browse Products →
          </Link>
        </div>
      ) : (
        <>
          {/* ORDER ITEMS */}
          <div className="checkout-section-card">
            <div className="checkout-section-title">
              🧾 Order Review
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "var(--muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {totalQty} item{totalQty !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="checkout-items-list">
              {cartItems.map((item) => (
                <div key={item.id} className="checkout-item">
                  <img src={item.image} alt={item.title} />
                  <div className="checkout-item-info">
                    <div className="checkout-item-name">{item.title}</div>
                    <div className="checkout-item-qty">Qty: {item.quantity}</div>
                  </div>
                  <div className="checkout-item-price">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ marginTop: "16px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13.5px",
                  color: "var(--slate)",
                  padding: "8px 0",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13.5px",
                  color: "var(--slate)",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span>Shipping</span>
                <span>
                  {shipping === 0 ? (
                    <span style={{ color: "var(--success)", fontWeight: "600" }}>FREE</span>
                  ) : (
                    `$${shipping.toFixed(2)}`
                  )}
                </span>
              </div>

              <div className="checkout-total-row">
                <span className="checkout-total-label">Total Due</span>
                <span className="checkout-total-value">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* PAYMENT SECTION */}
          <div className="checkout-section-card">
            <div className="checkout-section-title">💳 Payment</div>

            <div
              style={{
                background: "var(--bg)",
                border: "1.5px dashed var(--border-strong)",
                borderRadius: "var(--radius-md)",
                padding: "24px",
                textAlign: "center",
                marginBottom: "20px",
              }}
            >
              <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "6px" }}>
                Demo Mode — No real payment required
              </p>
              <p style={{ fontSize: "13px", color: "var(--muted)" }}>
                Clicking "Place Order" will fire a{" "}
                <code style={{ fontSize: "12px", background: "rgba(255,107,53,0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                  purchase
                </code>{" "}
                event to the AEP data layer.
              </p>
            </div>

            <button
              onClick={handlePayment}
              className="checkout-button"
              style={{ width: "100%", fontSize: "16px", padding: "16px" }}
            >
              🔒 Place Order — ${total.toFixed(2)}
            </button>

            <div className="security-note" style={{ justifyContent: "center" }}>
              <span>🔒</span>
              <span>256-bit SSL encrypted · Your data is safe</span>
            </div>
          </div>

          {/* AEP TRACKING NOTE */}
          <div
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "14px 18px",
              fontSize: "12.5px",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>📡</span>
            <span>
              <strong style={{ color: "var(--charcoal)" }}>AEP events:</strong>&nbsp;
              <code style={{ fontSize: "11px" }}>begin_checkout</code> fired on load ·&nbsp;
              <code style={{ fontSize: "11px" }}>purchase</code> fires on "Place Order"
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default Checkout;