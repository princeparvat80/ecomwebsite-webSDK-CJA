import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "../redux/cartSlice";
import axios from "axios";
import { toast } from "react-toastify";
import { slugify } from "../utils/slugify";
import { pushAddToCartEvent } from "../tracking/initDataLayer";

const CATEGORIES = ["All", "electronics", "jewelery", "men's clothing", "women's clothing"];

const renderStars = (rating) => {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(5 - full - (half ? 1 : 0));
};

const SkeletonCard = () => (
  <div className="skeleton-card">
    <div className="skeleton-img" style={{ height: "220px" }} />
    <div className="skeleton-body">
      <div className="skeleton-line short" style={{ marginBottom: "8px" }} />
      <div className="skeleton-line medium" style={{ marginBottom: "8px" }} />
      <div className="skeleton-line" style={{ width: "40%", height: "18px" }} />
    </div>
  </div>
);

const Product = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const dispatch = useDispatch();
  const cart = useSelector((state) => state.cart);

  useEffect(() => {
    axios
      .get("https://fakestoreapi.com/products")
      .then((res) => {
        setProducts(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching products:", err);
        setLoading(false);
      });
  }, []);

  const filteredProducts =
    activeCategory === "All"
      ? products
      : products.filter((p) => p.category === activeCategory);

  const handleAddToCart = (product) => {
    dispatch(addToCart(product));

    const existingItem = cart.cartItems.find((ci) => ci.id === product.id);
    const updatedItems = existingItem
      ? cart.cartItems.map((ci) =>
          ci.id === product.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        )
      : [...cart.cartItems, { ...product, quantity: 1 }];

    pushAddToCartEvent({
      product,
      cart: {
        items: updatedItems,
        totalQuantity: cart.totalQuantity + 1,
        totalAmount: cart.totalAmount + product.price,
      },
    });

    toast.success(`🛒 Added to cart!`, {
      position: "top-right",
      autoClose: 2000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: true,
    });
  };

  return (
    <div className="product-container">
      {/* PAGE HEADER */}
      <div className="page-header">
        <div className="page-header-inner">
          <div className="page-eyebrow">🛍️ Catalog</div>
          <h1 className="page-title">Our Products</h1>
          <p className="page-subtitle">Explore our curated collection — every action is tracked via AEP</p>
        </div>
      </div>

      {/* ── AJO ZONE: PRODUCTS PROMO STRIP ──────────────────────────────── */}
      {/* id="ajo-products-promo" — AJO activates via adding class ajo-active */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px 60px 0" }}>
        <div
          id="ajo-products-promo"
          className="ajo-products-promo"
          data-ajo-zone="products_promo_strip"
        >
          <span style={{ fontSize: "20px" }}>🎁</span>
          <span>
            <strong>AJO Promo Zone</strong> — This strip is reserved for targeted promotions from Adobe Journey Optimizer.
            &nbsp;<code style={{ fontSize: "11px", background: "rgba(255,107,53,0.1)", padding: "2px 6px", borderRadius: "4px" }}>data-ajo-zone="products_promo_strip"</code>
          </span>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="products-controls">
        <div className="product-count">
          Showing <strong>{filteredProducts.length}</strong> products
          {activeCategory !== "All" && ` in "${activeCategory}"`}
        </div>

        <div className="filter-chips">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`chip${activeCategory === cat ? " active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* GRID */}
      <div className="products-grid">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : filteredProducts.map((product, index) => (
              <div
                key={product.id}
                className="product-card"
                style={{ animationDelay: `${(index % 8) * 0.06}s` }}
              >
                {/* Image */}
                <div className="product-card-image-wrap">
                  {index < 3 && (
                    <span className="product-badge badge-new">New</span>
                  )}
                  <button className="wishlist-btn" aria-label="Add to wishlist">♡</button>
                  <img
                    src={product.image}
                    alt={product.title}
                    className="product-image"
                    loading="lazy"
                  />
                </div>

                {/* Body */}
                <div className="product-card-body">
                  <div className="product-category">{product.category}</div>
                  <h3>{product.title}</h3>

                  {product.rating && (
                    <div className="product-rating">
                      <span className="stars">{renderStars(product.rating.rate)}</span>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--charcoal)" }}>
                        {product.rating.rate}
                      </span>
                      <span className="rating-count">({product.rating.count})</span>
                    </div>
                  )}

                  <div className="product-price-row">
                    <span className="price">${product.price}</span>
                  </div>

                  <div className="product-buttons">
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="add-to-cart-button"
                    >
                      + Cart
                    </button>
                    <Link
                      to={`/product/${slugify(product.id, product.title)}`}
                      className="details-button"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
};

export default Product;