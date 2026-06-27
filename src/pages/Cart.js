import React, { useEffect, useState }  from "react";
import { useSelector, useDispatch }     from "react-redux";
import {
  removeFromCart,
  increaseQuantity,
  decreaseQuantity,
}                                        from "../redux/cartSlice";
import { Link, useNavigate }            from "react-router-dom";
import { useAuth }                      from "../auth/AuthContext";
import {
  pushCheckoutClickEvent,
  pushViewCartEvent,
  pushAddToCartEvent,
  pushRemoveFromCartEvent,
}                                        from "../tracking/initDataLayer";

const Cart = () => {
  const cart      = useSelector((state) => state.cart);
  const cartItems = cart.cartItems;
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { auth }  = useAuth();

  const [promoCode,    setPromoCode]    = useState("");
  const [promoApplied, setPromoApplied] = useState(false);

  /* UI totals — used only for display, not passed to tracking */
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const shipping = subtotal > 50 ? 0 : 4.99;
  const discount = promoApplied ? subtotal * 0.1 : 0;
  const total    = subtotal - discount + shipping;

  /*
    Fire view_cart once on mount when cart has items.
    Passes the full Redux cart object — pushViewCartEvent reads
    cart.cartItems internally and runs it through buildCartData().
  */
  useEffect(() => {
    if (cartItems.length > 0) {
      pushViewCartEvent(cart);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckout = (e) => {
    e.preventDefault();
    pushCheckoutClickEvent();
    if (!auth.isAuthenticated) {
      navigate("/login", { state: { from: "/checkout" } });
      return;
    }
    navigate("/checkout");
  };

  /*
    handleDecrease — quantity goes down by 1, or item is removed if qty reaches 0.
    Build the post-action items array first, then dispatch, then push.
    If newQty === 0 the item is filtered out — matching what decreaseQuantity
    does in cartSlice (removes the item when qty would go below 1).
  */
  const handleDecrease = (item) => {
    const newQty      = item.quantity - 1;
    const updatedItems = cartItems
      .map((ci) => ci.id === item.id ? { ...ci, quantity: newQty } : ci)
      .filter((ci) => ci.quantity > 0);

    dispatch(decreaseQuantity(item.id));

    pushRemoveFromCartEvent({
      product: item,
      cart:    { items: updatedItems },
    });
  };

  /*
    handleIncrease — quantity goes up by 1.
    Fires add_to_cart because the user is adding one more unit.
  */
  const handleIncrease = (item) => {
    const updatedItems = cartItems.map((ci) =>
      ci.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
    );

    dispatch(increaseQuantity(item.id));

    pushAddToCartEvent({
      product: item,
      cart:    { items: updatedItems },
    });
  };

  /*
    handleRemove — entire line item removed regardless of quantity.
    Post-action items = everything except the removed item.
  */
  const handleRemove = (item) => {
    const updatedItems = cartItems.filter((ci) => ci.id !== item.id);

    dispatch(removeFromCart(item.id));

    pushRemoveFromCartEvent({
      product: item,
      cart:    { items: updatedItems },
    });
  };

  /* ── Empty state ── */
  if (cartItems.length === 0) {
    return (
      <div className="cart-page-layout" style={{ display: "block", padding: "60px" }}>
        <div className="empty-cart">
          <div className="empty-cart-icon">🛒</div>
          <h2>Your cart is empty</h2>
          <p>Looks like you haven't added anything yet. Let's fix that!</p>
          <Link to="/products" className="btn btn-primary btn-lg">
            Browse Products →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page-layout">

      {/* ── LEFT: CART ITEMS ── */}
      <div className="cart-main">
        <div className="cart-header">
          <h1 className="cart-title">Your Cart</h1>
          <span className="cart-count-label">
            {totalQty} item{totalQty !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── AJO ZONE: CART UPSELL ── */}
        <div
          id="ajo-cart-upsell"
          className="ajo-cart-upsell"
          data-ajo-zone="cart_upsell"
        >
          <div className="ajo-cart-upsell-label">✨ Recommended For You</div>
          <p style={{ fontSize: "13.5px", color: "var(--slate)", marginBottom: "0" }}>
            This zone is reserved for <strong>AJO Cart Upsell</strong> recommendations.
            Adobe Journey Optimizer will inject personalized product suggestions here.
            &nbsp;
            <code style={{ fontSize: "11px", background: "rgba(255,107,53,0.1)", padding: "2px 6px", borderRadius: "4px" }}>
              data-ajo-zone="cart_upsell"
            </code>
          </p>
        </div>

        {/* CART ITEMS */}
        {cartItems.map((item, i) => (
          <div
            key={item.id}
            className="cart-item"
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            <img
              src={item.image}
              alt={item.title}
              className="cart-item-image"
            />

            <div className="cart-item-info">
              <div className="cart-item-category">{item.category}</div>
              <h3>{item.title}</h3>
              <div className="cart-item-price">${item.price}</div>
            </div>

            <div className="cart-item-actions">
              {/* Quantity controls */}
              <div className="quantity-controls">
                <button
                  className="quantity-button"
                  onClick={() => handleDecrease(item)}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="qty-display">{item.quantity}</span>
                <button
                  className="quantity-button"
                  onClick={() => handleIncrease(item)}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              {/* Line total */}
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize:   "16px",
                  fontWeight: "700",
                  color:      "var(--navy)",
                  minWidth:   "64px",
                  textAlign:  "right",
                }}
              >
                ${(item.price * item.quantity).toFixed(2)}
              </div>

              {/* Remove */}
              <button
                className="remove-button"
                onClick={() => handleRemove(item)}
                aria-label="Remove item"
              >
                🗑
              </button>
            </div>
          </div>
        ))}

        {/* Free shipping nudge */}
        {subtotal < 50 && (
          <div
            style={{
              background:   "var(--accent-light)",
              border:       "1px solid rgba(255,107,53,0.18)",
              borderRadius: "var(--radius-md)",
              padding:      "14px 18px",
              fontSize:     "13.5px",
              color:        "var(--slate)",
              display:      "flex",
              alignItems:   "center",
              gap:          "10px",
            }}
          >
            <span>🚚</span>
            <span>
              Add <strong>${(50 - subtotal).toFixed(2)}</strong> more for{" "}
              <strong style={{ color: "var(--accent)" }}>free shipping</strong>!
            </span>
          </div>
        )}
      </div>

      {/* ── RIGHT: ORDER SUMMARY SIDEBAR ── */}
      <div className="cart-sidebar">
        <div className="order-summary">
          <h3>Order Summary</h3>

          <div className="summary-line">
            <span>Subtotal ({totalQty} items)</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>

          {promoApplied && (
            <div className="summary-line" style={{ color: "var(--success)" }}>
              <span>Promo (10% off)</span>
              <span>−${discount.toFixed(2)}</span>
            </div>
          )}

          <div className="summary-line">
            <span>Shipping</span>
            <span>
              {shipping === 0 ? (
                <span style={{ color: "var(--success)", fontWeight: "600" }}>FREE</span>
              ) : (
                `$${shipping.toFixed(2)}`
              )}
            </span>
          </div>

          <div className="summary-line summary-total">
            <span>Total</span>
            <span className="summary-total-val">${total.toFixed(2)}</span>
          </div>

          {/* Promo code input */}
          <div className="promo-input-row">
            <input
              type="text"
              className="promo-input"
              placeholder="Promo code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              disabled={promoApplied}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { if (promoCode === "AEP10") setPromoApplied(true); }}
              disabled={promoApplied || !promoCode}
            >
              {promoApplied ? "✓" : "Apply"}
            </button>
          </div>

          {promoCode && promoCode !== "AEP10" && !promoApplied && (
            <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px" }}>
              Try code: <strong>AEP10</strong>
            </p>
          )}

          {/* Checkout CTA */}
          <button
            onClick={handleCheckout}
            className="checkout-button"
            style={{ width: "100%", marginTop: "16px" }}
          >
            {auth.isAuthenticated ? "Proceed to Checkout →" : "Sign In to Checkout →"}
          </button>

          <div className="security-note">
            <span>🔒</span>
            <span>Secure 256-bit SSL encrypted checkout</span>
          </div>
        </div>

        <Link
          to="/products"
          className="btn btn-ghost"
          style={{ width: "100%", justifyContent: "center", border: "1.5px solid var(--border)" }}
        >
          ← Continue Shopping
        </Link>
      </div>

    </div>
  );
};

export default Cart;