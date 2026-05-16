import React, { useState, useEffect }          from "react";
import { useParams, Link }                      from "react-router-dom";
import { useDispatch, useSelector }             from "react-redux";
import { addToCart }                            from "../redux/cartSlice";
import axios                                    from "axios";
import { toast }                                from "react-toastify";
import { pushViewItemEvent, pushAddToCartEvent } from "../tracking/initDataLayer";

const renderStars = (rating) => {
  if (!rating) return "☆☆☆☆☆";
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(5 - full - (half ? 1 : 0));
};

const ProductDetail = () => {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [added,   setAdded]   = useState(false);

  const dispatch   = useDispatch();
  const { slug }   = useParams();
  const productId  = slug.split("-")[0];
  const cart       = useSelector((state) => state.cart);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);

    axios
      .get(`https://fakestoreapi.com/products/${productId}`)
      .then((res) => {
        const data = res.data;
        setProduct(data);
        setLoading(false);

        /*
          pushViewItemEvent replaces the old updateProductDataLayer call.
          Passes the product exactly as the API returns it — pushViewItemEvent
          reads rating directly from data.rating.rate internally via
          the _princeparvat.rating field in productListItems.
        */
        pushViewItemEvent({
          id:          data.id,
          name:        data.title,
          category:    data.category,
          price:       data.price,
          currency:    "USD",
          rating:      data.rating?.rate  || null,
          description: data.description   || null,
        });
      })
      .catch((err) => {
        console.error("Error fetching product:", err);
        setLoading(false);
      });
  }, [productId]);

  const handleAddToCart = () => {
    if (!product) return;

    /*
      Build updatedItems BEFORE dispatching to Redux — same pattern
      as Product.js. Redux hasn't processed the dispatch yet so the
      selector still returns the pre-add state at this point.
      Pass only items array — buildCartData() in initDataLayer.js
      computes all totals from the items.
    */
    const existingItem = cart.cartItems.find((ci) => ci.id === product.id);
    const updatedItems = existingItem
      ? cart.cartItems.map((ci) =>
          ci.id === product.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        )
      : [...cart.cartItems, { ...product, quantity: 1 }];

    dispatch(addToCart(product));

    pushAddToCartEvent({
      product,
      cart: { items: updatedItems },
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 2200);

    toast.success("🛒 Added to cart!", {
      position:        "top-right",
      autoClose:       2000,
      hideProgressBar: false,
      closeOnClick:    true,
      pauseOnHover:    false,
      draggable:       true,
    });
  };

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="product-detail-container">
        <div className="product-detail">
          <div className="product-detail-image-section">
            <div
              className="product-detail-image-wrap"
              style={{
                background:     "linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)",
                backgroundSize: "200% 100%",
                animation:      "shimmer 1.5s infinite",
              }}
            />
          </div>
          <div className="product-info">
            {[100, 60, 80, 40, 90, 70].map((w, i) => (
              <div
                key={i}
                className="skeleton-line"
                style={{ width: `${w}%`, height: i === 0 ? "28px" : "16px", marginBottom: "12px" }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Product not found ── */
  if (!product) {
    return (
      <div className="product-detail-container">
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: "60px", marginBottom: "20px" }}>😕</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "24px", color: "var(--navy)" }}>
            Product not found
          </h2>
          <Link
            to="/products"
            className="btn btn-primary"
            style={{ marginTop: "20px", display: "inline-flex" }}
          >
            ← Back to Products
          </Link>
        </div>
      </div>
    );
  }

  /* ── Product detail view ── */
  return (
    <div className="product-detail-container">
      <div className="product-detail">

        {/* IMAGE SECTION */}
        <div className="product-detail-image-section">
          <div className="product-detail-image-wrap">
            <img
              src={product.image}
              alt={product.title}
              className="product-detail-image"
            />
          </div>

          <div className="trust-badges" style={{ marginTop: "20px" }}>
            <div className="trust-badge">
              <span className="trust-badge-icon">🔒</span>
              <span>Secure Checkout</span>
            </div>
            <div className="trust-badge">
              <span className="trust-badge-icon">🚚</span>
              <span>Free Shipping</span>
            </div>
            <div className="trust-badge">
              <span className="trust-badge-icon">↩️</span>
              <span>Easy Returns</span>
            </div>
          </div>
        </div>

        {/* INFO SECTION */}
        <div className="product-info">

          <div className="product-info-category">
            🏷️ {product.category}
          </div>

          <h1>{product.title}</h1>

          {product.rating && (
            <div className="product-rating-row">
              <span style={{ color: "var(--warning)", fontSize: "18px", letterSpacing: "-1px" }}>
                {renderStars(product.rating.rate)}
              </span>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--charcoal)" }}>
                {product.rating.rate} / 5
              </span>
              <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                ({product.rating.count} reviews)
              </span>
            </div>
          )}

          <div>
            <span className="product-price">
              <span className="currency">$</span>
              {product.price}
            </span>
            <span
              style={{
                marginLeft:   "10px",
                fontSize:     "12px",
                background:   "rgba(16,185,129,0.1)",
                color:        "var(--success)",
                padding:      "3px 10px",
                borderRadius: "var(--radius-full)",
                fontWeight:   "700",
              }}
            >
              In Stock
            </span>
          </div>

          <p className="product-description">{product.description}</p>

          <div className="product-action-row">
            <button
              onClick={handleAddToCart}
              className="add-to-cart-button"
              style={{
                flex:          1,
                justifyContent:"center",
                padding:       "14px 20px",
                fontSize:      "15px",
                borderRadius:  "var(--radius-md)",
                background:    added ? "var(--success)" : undefined,
                transition:    "all 0.25s ease",
              }}
            >
              {added ? "✓ Added!" : "🛒 Add to Cart"}
            </button>

            <Link to="/products" className="back-button">
              ← Back
            </Link>
          </div>

          {/* AEP tracking note */}
          <div
            style={{
              background:   "var(--bg)",
              border:       "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding:      "14px 16px",
              fontSize:     "12.5px",
              color:        "var(--muted)",
              lineHeight:   "1.6",
            }}
          >
            <strong style={{ color: "var(--charcoal)" }}>📡 AEP Tracking:</strong>&nbsp;
            <code style={{ fontSize: "11px" }}>view_item</code> pushed on load ·&nbsp;
            <code style={{ fontSize: "11px" }}>add_to_cart</code> pushed on button click ·&nbsp;
            SKU: <code style={{ fontSize: "11px" }}>{product.id}</code>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProductDetail;