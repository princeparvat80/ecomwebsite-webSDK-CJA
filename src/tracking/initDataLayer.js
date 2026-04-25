/* ============================================================
   PRINCE AEP LAB — DATA LAYER
   window.dataLayer schema — XDM-aligned for Adobe Launch rules
   All events are read by Adobe Data Collection UI (Launch) via
   Data Elements pointing to window.dataLayer.* paths.
   ============================================================ */

export const initDataLayer = () => {
  window.dataLayer = {
    /* ── PAGE CONTEXT ── */
    page: {
      name: null,           // Home | Products | Cart | Checkout | etc.
      type: null,           // home | product_list | product_detail | cart | checkout | login | order_confirmation
      url: window.location.pathname,
      previousPage: null,
      referrerType: "direct", // direct | internal | external
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    },

    /* ── USER / IDENTITY CONTEXT ── */
    user: {
      isLoggedIn: false,
      loginState: "guest",    // guest | authenticated
      authId: null,           // email address (set on login)
      authNamespace: null,    // email (namespace type for AEP identity)
    },

    /* ── COMMERCE CONTEXT ── */
    commerce: {
      cart: {
        id: null,
        itemCount: 0,
        totalQuantity: 0,
        totalValue: 0,
        currency: "USD",
        items: [],
      },
    },

    /* ── PRODUCT CONTEXT (PDP / clicks) ── */
    product: {
      id: null,
      name: null,
      category: null,
      price: null,
      currency: "USD",
      rating: null,
      description: null,
    },

    /* ── TRANSACTION CONTEXT (purchase) ── */
    transaction: {
      orderId: null,
      revenue: null,
      currency: "USD",
    },

    /* ── CART SNAPSHOT (commerce events) ── */
    cart: {
      items: [],
      totalQuantity: 0,
      totalValue: 0,
      currency: "USD",
    },

    /* ── UI / INTERACTION CONTEXT ── */
    ui: {
      ctaLabel: null,
      ctaLocation: null,
      interactionType: null,  // click | submit | view
      scrollDepth: null,
      formError: null,
    },

    /* ── EVENT CONTEXT (Launch rules key off event.name) ── */
    event: {
      name: null,             // page_view | add_to_cart | remove_from_cart | view_cart |
                              // begin_checkout | checkout_click | purchase | login |
                              // exit_intent | feedback_submitted
      category: null,         // navigation | commerce | identity | ui
      timestamp: null,
    },

    /* ── META / GOVERNANCE ── */
    meta: {
      environment: "prod",
      appVersion: "2.0.0",
      trackingVersion: "aep-princeparvat-v2",
    },
  };

  console.log("✅ AEP dataLayer initialized:", window.dataLayer);
};

/* ────────────────────────────────────────────────────────────
   HELPER: Normalize cart items (dedup by id, merge quantities)
   Used by all commerce events to ensure clean data.
   ──────────────────────────────────────────────────────────── */
const normalizeCartItems = (items = []) => {
  const map = {};
  items.forEach((item) => {
    const id = String(item.id);
    if (!map[id]) {
      map[id] = {
        id,
        name: item.title || item.name,
        category: item.category || null,
        price: item.price,
        quantity: item.quantity,
      };
    } else {
      map[id].quantity += item.quantity;
    }
  });
  return Object.values(map);
};

const sumQty = (items) => items.reduce((s, i) => s + i.quantity, 0);
const sumVal = (items) => items.reduce((s, i) => s + i.price * i.quantity, 0);

/* ────────────────────────────────────────────────────────────
   updateProductDataLayer
   Called on PDP load to set product context.
   ──────────────────────────────────────────────────────────── */
export const updateProductDataLayer = (product) => {
  if (!window.dataLayer) return;

  window.dataLayer.product = {
    id: String(product.id),
    name: product.name,
    category: product.category,
    price: product.price,
    currency: product.currency || "USD",
    rating: product.rating || null,
    description: product.description || null,
  };

  window.dataLayer.event = {
    name: "view_item",
    category: "commerce",
    timestamp: Date.now(),
  };

  console.log("👁️  view_item event fired:", window.dataLayer);
  if (window._satellite?.track) {
    window._satellite.track("aep_view_item");
  }
};

/* ────────────────────────────────────────────────────────────
   pushAddToCartEvent
   ──────────────────────────────────────────────────────────── */
export const pushAddToCartEvent = ({ product, cart }) => {
  if (!window.dataLayer || !cart?.items) return;

  const normalizedItems = normalizeCartItems(cart.items);
  const totalQuantity = sumQty(normalizedItems);
  const totalValue = sumVal(normalizedItems);

  window.dataLayer.product = {
    id: String(product.id),
    name: product.title || product.name,
    category: product.category,
    price: product.price,
    currency: "USD",
  };

  window.dataLayer.cart = {
    items: normalizedItems,
    totalQuantity,
    totalValue,
    currency: "USD",
  };

  window.dataLayer.event = {
    name: "add_to_cart",
    category: "commerce",
    timestamp: Date.now(),
  };

  console.log("🛒 add_to_cart event fired:", window.dataLayer);
  if (window._satellite?.track) {
    window._satellite.track("aep_add_to_cart");
  }
};

/* ────────────────────────────────────────────────────────────
   pushRemoveFromCartEvent
   ──────────────────────────────────────────────────────────── */
export const pushRemoveFromCartEvent = ({ product, cart }) => {
  if (!window.dataLayer) return;

  const normalizedItems = normalizeCartItems(cart.items || []);
  const totalQuantity = sumQty(normalizedItems);
  const totalValue = sumVal(normalizedItems);

  window.dataLayer.product = {
    id: String(product.id),
    name: product.title || product.name,
    category: product.category,
    price: product.price,
    currency: "USD",
  };

  window.dataLayer.cart = {
    items: normalizedItems,
    totalQuantity,
    totalValue,
    currency: "USD",
  };

  window.dataLayer.event = {
    name: "remove_from_cart",
    category: "commerce",
    timestamp: Date.now(),
  };

  console.log("🗑️  remove_from_cart event fired:", window.dataLayer);
  if (window._satellite?.track) {
    window._satellite.track("aep_remove_from_cart");
  }
};

/* ────────────────────────────────────────────────────────────
   pushViewCartEvent
   ──────────────────────────────────────────────────────────── */
export const pushViewCartEvent = (cart) => {
  if (!window.dataLayer || !cart?.cartItems) return;

  const normalizedItems = normalizeCartItems(cart.cartItems);
  const totalQuantity = sumQty(normalizedItems);
  const totalValue = sumVal(normalizedItems);

  window.dataLayer.cart = {
    items: normalizedItems,
    totalQuantity,
    totalValue,
    currency: "USD",
  };

  window.dataLayer.event = {
    name: "view_cart",
    category: "commerce",
    timestamp: Date.now(),
  };

  console.log("👀 view_cart event fired:", window.dataLayer);
  if (window._satellite?.track) {
    window._satellite.track("aep_view_cart");
  }
};

/* ────────────────────────────────────────────────────────────
   pushBeginCheckoutEvent
   ──────────────────────────────────────────────────────────── */
export const pushBeginCheckoutEvent = (cart) => {
  if (!window.dataLayer || !cart?.cartItems) return;

  const normalizedItems = normalizeCartItems(cart.cartItems);
  const totalQuantity = sumQty(normalizedItems);
  const totalValue = sumVal(normalizedItems);

  window.dataLayer.cart = {
    items: normalizedItems,
    totalQuantity,
    totalValue,
    currency: "USD",
  };

  window.dataLayer.event = {
    name: "begin_checkout",
    category: "commerce",
    timestamp: Date.now(),
  };

  console.log("💳 begin_checkout event fired:", window.dataLayer);
  if (window._satellite?.track) {
    window._satellite.track("aep_begin_checkout");
  }
};

/* ────────────────────────────────────────────────────────────
   pushCheckoutClickEvent
   Fired when user clicks "Go to Checkout" on cart page.
   ──────────────────────────────────────────────────────────── */
export const pushCheckoutClickEvent = () => {
  if (!window.dataLayer) return;

  window.dataLayer.ui = {
    ...window.dataLayer.ui,
    ctaLabel: "Go to Checkout",
    ctaLocation: "cart",
    interactionType: "click",
  };

  window.dataLayer.event = {
    name: "checkout_click",
    category: "interaction",
    timestamp: Date.now(),
  };

  console.log("🖱️  checkout_click event fired:", window.dataLayer);
  if (window._satellite?.track) {
    window._satellite.track("aep_checkout_click");
  }
};

/* ────────────────────────────────────────────────────────────
   pushPurchaseEvent
   Fired BEFORE cart is cleared, passes orderId.
   ──────────────────────────────────────────────────────────── */
export const pushPurchaseEvent = ({ cart, orderId }) => {
  if (!window.dataLayer || !cart?.cartItems) return;

  const normalizedItems = normalizeCartItems(cart.cartItems);
  const totalQuantity = sumQty(normalizedItems);
  const totalValue = sumVal(normalizedItems);

  window.dataLayer.cart = {
    items: normalizedItems,
    totalQuantity,
    totalValue,
    currency: "USD",
  };

  window.dataLayer.transaction = {
    orderId,
    revenue: totalValue,
    currency: "USD",
  };

  window.dataLayer.event = {
    name: "purchase",
    category: "commerce",
    timestamp: Date.now(),
  };

  console.log("✅ purchase event fired:", window.dataLayer);
  if (window._satellite?.track) {
    window._satellite.track("aep_purchase");
  }
};