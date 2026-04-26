/* ============================================================
   PRINCE AEP LAB — DATA LAYER v4

   THREE KEY OBJECTS EXPLAINED:
   ─────────────────────────────
   1. dataLayer.commerce        → XDM action FLAG (what happened)
      e.g. commerce.productListAdds = { value: 1 }
      Maps directly to xdm.commerce.* in Launch

   2. dataLayer.cart            → Internal cart state snapshot
      e.g. cart.items[], cart.totalValue
      Used by Launch to build productListItems

   3. dataLayer.productListItems → XDM-ready product array ← NEW
      e.g. [ { SKU, name, priceTotal, quantity, currencyCode } ]
      Field names match XDM exactly.
      Launch reads this directly → zero transformation needed.
      THIS is what you see expand in CJA per product.
   ============================================================ */

export const initDataLayer = () => {
  window.dataLayer = {

    /* ── PAGE CONTEXT ── */
    page: {
      name:         null,
      type:         null,
      url:          window.location.pathname,
      previousPage: null,
      referrerType: "direct",
      viewport: {
        width:  window.innerWidth,
        height: window.innerHeight,
      },
    },

    /* ── USER / IDENTITY CONTEXT ── */
    user: {
      isLoggedIn:    false,
      loginState:    "guest",
      authId:        null,
      authNamespace: null,
    },

    /* ── COMMERCE ACTION FLAGS (XDM-aligned) ──────────────────
       Only ONE flag is set to { value:1 } per event.
       All others are null. resetCommerceFlags() clears before
       each event to prevent stale values.
       ────────────────────────────────────────────────────────── */
    commerce: {
      productViews:        null,   // view_item
      productListViews:    null,   // view_cart
      productListAdds:     null,   // add_to_cart
      productListRemovals: null,   // remove_from_cart
      checkouts:           null,   // begin_checkout
      purchases:           null,   // purchase
      order: {
        purchaseID:   null,
        priceTotal:   null,
        currencyCode: "USD",
      },
    },

    /* ── CART STATE SNAPSHOT ──────────────────────────────────
       Full cart at moment of event. Internal field names.
       ────────────────────────────────────────────────────────── */
    cart: {
      items:         [],
      totalQuantity: 0,
      totalValue:    0,
      currency:      "USD",
    },

    /* ── PRODUCT LIST ITEMS (XDM-ready array) ─────────────────
       Same data as cart.items but field names match XDM exactly:
         SKU          → productListItems[].SKU
         name         → productListItems[].name
         priceTotal   → productListItems[].priceTotal
         quantity     → productListItems[].quantity
         currencyCode → productListItems[].currencyCode
         category     → productListItems[]._prince.category (custom)

       This array is what CJA expands per product row.
       Launch reads it directly with zero transformation.
       ────────────────────────────────────────────────────────── */
    productListItems: [],

    /* ── PRODUCT CONTEXT (last touched product) ── */
    product: {
      id:          null,
      name:        null,
      category:    null,
      price:       null,
      currency:    "USD",
      rating:      null,
      description: null,
    },

    /* ── TRANSACTION CONTEXT (purchase only) ── */
    transaction: {
      orderId:  null,
      revenue:  null,
      currency: "USD",
    },

    /* ── UI / INTERACTION CONTEXT ── */
    ui: {
      ctaLabel:        null,
      ctaLocation:     null,
      interactionType: null,
      scrollDepth:     null,
      formError:       null,
    },

    /* ── EVENT CONTEXT ── */
    event: {
      name:      null,
      category:  null,
      timestamp: null,
    },

    /* ── META / GOVERNANCE ── */
    meta: {
      environment:     "prod",
      appVersion:      "2.0.0",
      trackingVersion: "aep-princeparvat-v4",
    },
  };

  console.log("✅ AEP dataLayer v4 initialized:", window.dataLayer);
};

/* ────────────────────────────────────────────────────────────
   HELPER: Reset commerce flags to null before each event.
   ──────────────────────────────────────────────────────────── */
const resetCommerceFlags = () => {
  window.dataLayer.commerce = {
    productViews:        null,
    productListViews:    null,
    productListAdds:     null,
    productListRemovals: null,
    checkouts:           null,
    purchases:           null,
    order: {
      purchaseID:   null,
      priceTotal:   null,
      currencyCode: "USD",
    },
  };
};

/* ────────────────────────────────────────────────────────────
   HELPER: Normalize cart items — two outputs:
   
   1. normalizedItems  → internal cart snapshot (dataLayer.cart.items)
      Uses field: name (internal)
   
   2. productListItems → XDM-ready array (dataLayer.productListItems)
      Uses field: SKU, name, priceTotal, quantity, currencyCode
      These exact field names map to XDM productListItems schema.
   ──────────────────────────────────────────────────────────── */
const buildCartData = (items = []) => {
  const map = {};

  items.forEach((item) => {
    const id = String(item.id);
    if (!map[id]) {
      map[id] = {
        id,
        name:     item.title || item.name,
        category: item.category || null,
        price:    item.price,
        quantity: item.quantity,
      };
    } else {
      map[id].quantity += item.quantity;
    }
  });

  const normalizedItems = Object.values(map);

  // XDM-ready productListItems — field names match schema exactly
  const productListItems = normalizedItems.map((item) => ({
    SKU:          item.id,
    name:         item.name,
    priceTotal:   parseFloat((item.price * item.quantity).toFixed(2)),
    quantity:     item.quantity,
    currencyCode: "USD",
    _prince: {
      category:   item.category || null,
      unitPrice:  item.price,
    },
  }));

  return { normalizedItems, productListItems };
};

const sumQty = (items) => items.reduce((s, i) => s + i.quantity, 0);
const sumVal = (items) => items.reduce((s, i) => s + i.price * i.quantity, 0);

/* ────────────────────────────────────────────────────────────
   updateProductDataLayer — view_item
   commerce.productViews = { value: 1 }
   productListItems = [ the viewed product ]
   ──────────────────────────────────────────────────────────── */
export const updateProductDataLayer = (product) => {
  if (!window.dataLayer) return;

  resetCommerceFlags();

  window.dataLayer.product = {
    id:          String(product.id),
    name:        product.name,
    category:    product.category,
    price:       product.price,
    currency:    product.currency || "USD",
    rating:      product.rating   || null,
    description: product.description || null,
  };

  // For view_item, productListItems = the single product being viewed
  window.dataLayer.productListItems = [{
    SKU:          String(product.id),
    name:         product.name,
    priceTotal:   product.price,
    quantity:     1,
    currencyCode: "USD",
    _prince: {
      category:  product.category || null,
      unitPrice: product.price,
    },
  }];

  window.dataLayer.commerce.productViews = { value: 1 };

  window.dataLayer.event = {
    name:      "view_item",
    category:  "commerce",
    timestamp: Date.now(),
  };

  console.log("👁️  view_item fired");
  console.log("   commerce.productViews:", window.dataLayer.commerce.productViews);
  console.log("   productListItems:", window.dataLayer.productListItems);
  if (window._satellite?.track) window._satellite.track("aep_view_item");
};

/* ────────────────────────────────────────────────────────────
   pushAddToCartEvent — add_to_cart
   commerce.productListAdds = { value: 1 }
   productListItems = full cart after add
   ──────────────────────────────────────────────────────────── */
export const pushAddToCartEvent = ({ product, cart }) => {
  if (!window.dataLayer || !cart?.items) return;

  resetCommerceFlags();

  const { normalizedItems, productListItems } = buildCartData(cart.items);
  const totalQuantity = sumQty(normalizedItems);
  const totalValue    = sumVal(normalizedItems);

  window.dataLayer.product = {
    id:       String(product.id),
    name:     product.title || product.name,
    category: product.category,
    price:    product.price,
    currency: "USD",
  };

  window.dataLayer.commerce.productListAdds = { value: 1 };

  window.dataLayer.cart = {
    items:         normalizedItems,
    totalQuantity,
    totalValue,
    currency:      "USD",
  };

  // ✅ XDM-ready array — visible in dataLayer, readable by Launch
  window.dataLayer.productListItems = productListItems;

  window.dataLayer.event = {
    name:      "add_to_cart",
    category:  "commerce",
    timestamp: Date.now(),
  };

  console.log("🛒 add_to_cart fired");
  console.log("   commerce.productListAdds:", window.dataLayer.commerce.productListAdds);
  console.log("   productListItems:", window.dataLayer.productListItems);
  console.log("   cart snapshot:", window.dataLayer.cart);
  if (window._satellite?.track) window._satellite.track("aep_add_to_cart");
};

/* ────────────────────────────────────────────────────────────
   pushRemoveFromCartEvent — remove_from_cart
   commerce.productListRemovals = { value: 1 }
   productListItems = cart AFTER removal
   ──────────────────────────────────────────────────────────── */
export const pushRemoveFromCartEvent = ({ product, cart }) => {
  if (!window.dataLayer) return;

  resetCommerceFlags();

  const { normalizedItems, productListItems } = buildCartData(cart.items || []);
  const totalQuantity = sumQty(normalizedItems);
  const totalValue    = sumVal(normalizedItems);

  window.dataLayer.product = {
    id:       String(product.id),
    name:     product.title || product.name,
    category: product.category,
    price:    product.price,
    currency: "USD",
  };

  window.dataLayer.commerce.productListRemovals = { value: 1 };

  window.dataLayer.cart = {
    items:         normalizedItems,
    totalQuantity,
    totalValue,
    currency:      "USD",
  };

  window.dataLayer.productListItems = productListItems;

  window.dataLayer.event = {
    name:      "remove_from_cart",
    category:  "commerce",
    timestamp: Date.now(),
  };

  console.log("🗑️  remove_from_cart fired");
  console.log("   commerce.productListRemovals:", window.dataLayer.commerce.productListRemovals);
  console.log("   productListItems:", window.dataLayer.productListItems);
  console.log("   cart snapshot:", window.dataLayer.cart);
  if (window._satellite?.track) window._satellite.track("aep_remove_from_cart");
};

/* ────────────────────────────────────────────────────────────
   pushViewCartEvent — view_cart
   commerce.productListViews = { value: 1 }
   productListItems = everything in cart
   ──────────────────────────────────────────────────────────── */
export const pushViewCartEvent = (cart) => {
  if (!window.dataLayer || !cart?.cartItems) return;

  resetCommerceFlags();

  const { normalizedItems, productListItems } = buildCartData(cart.cartItems);
  const totalQuantity = sumQty(normalizedItems);
  const totalValue    = sumVal(normalizedItems);

  window.dataLayer.commerce.productListViews = { value: 1 };

  window.dataLayer.cart = {
    items:         normalizedItems,
    totalQuantity,
    totalValue,
    currency:      "USD",
  };

  window.dataLayer.productListItems = productListItems;

  window.dataLayer.event = {
    name:      "view_cart",
    category:  "commerce",
    timestamp: Date.now(),
  };

  console.log("👀 view_cart fired");
  console.log("   commerce.productListViews:", window.dataLayer.commerce.productListViews);
  console.log("   productListItems:", window.dataLayer.productListItems);
  console.log("   cart snapshot:", window.dataLayer.cart);
  if (window._satellite?.track) window._satellite.track("aep_view_cart");
};

/* ────────────────────────────────────────────────────────────
   pushBeginCheckoutEvent — begin_checkout
   commerce.checkouts = { value: 1 }
   productListItems = everything in cart
   ──────────────────────────────────────────────────────────── */
export const pushBeginCheckoutEvent = (cart) => {
  if (!window.dataLayer || !cart?.cartItems) return;

  resetCommerceFlags();

  const { normalizedItems, productListItems } = buildCartData(cart.cartItems);
  const totalQuantity = sumQty(normalizedItems);
  const totalValue    = sumVal(normalizedItems);

  window.dataLayer.commerce.checkouts = { value: 1 };

  window.dataLayer.cart = {
    items:         normalizedItems,
    totalQuantity,
    totalValue,
    currency:      "USD",
  };

  window.dataLayer.productListItems = productListItems;

  window.dataLayer.event = {
    name:      "begin_checkout",
    category:  "commerce",
    timestamp: Date.now(),
  };

  console.log("💳 begin_checkout fired");
  console.log("   commerce.checkouts:", window.dataLayer.commerce.checkouts);
  console.log("   productListItems:", window.dataLayer.productListItems);
  console.log("   cart snapshot:", window.dataLayer.cart);
  if (window._satellite?.track) window._satellite.track("aep_begin_checkout");
};

/* ────────────────────────────────────────────────────────────
   pushCheckoutClickEvent — checkout_click (UI interaction)
   No commerce flag. No productListItems change.
   ──────────────────────────────────────────────────────────── */
export const pushCheckoutClickEvent = () => {
  if (!window.dataLayer) return;

  window.dataLayer.ui = {
    ...window.dataLayer.ui,
    ctaLabel:        "Go to Checkout",
    ctaLocation:     "cart",
    interactionType: "click",
  };

  window.dataLayer.event = {
    name:      "checkout_click",
    category:  "interaction",
    timestamp: Date.now(),
  };

  console.log("🖱️  checkout_click fired");
  if (window._satellite?.track) window._satellite.track("aep_checkout_click");
};

/* ────────────────────────────────────────────────────────────
   pushPurchaseEvent — purchase
   commerce.purchases = { value: 1 }
   commerce.order     = { purchaseID, priceTotal, currencyCode }
   productListItems   = every item purchased (most important!)
   ──────────────────────────────────────────────────────────── */
export const pushPurchaseEvent = ({ cart, orderId }) => {
  if (!window.dataLayer || !cart?.cartItems) return;

  resetCommerceFlags();

  const { normalizedItems, productListItems } = buildCartData(cart.cartItems);
  const totalQuantity = sumQty(normalizedItems);
  const totalValue    = sumVal(normalizedItems);

  window.dataLayer.commerce.purchases = { value: 1 };

  window.dataLayer.commerce.order = {
    purchaseID:   orderId,
    priceTotal:   parseFloat(totalValue.toFixed(2)),
    currencyCode: "USD",
  };

  window.dataLayer.cart = {
    items:         normalizedItems,
    totalQuantity,
    totalValue:    parseFloat(totalValue.toFixed(2)),
    currency:      "USD",
  };

  // ✅ Most critical productListItems — every purchased product
  // CJA will expand this into one row per product for analysis
  window.dataLayer.productListItems = productListItems;

  window.dataLayer.transaction = {
    orderId,
    revenue:  parseFloat(totalValue.toFixed(2)),
    currency: "USD",
  };

  window.dataLayer.event = {
    name:      "purchase",
    category:  "commerce",
    timestamp: Date.now(),
  };

  console.log("✅ purchase fired");
  console.log("   commerce.purchases:", window.dataLayer.commerce.purchases);
  console.log("   commerce.order:", window.dataLayer.commerce.order);
  console.log("   productListItems:", window.dataLayer.productListItems);
  console.log("   cart snapshot:", window.dataLayer.cart);
  if (window._satellite?.track) window._satellite.track("aep_purchase");
};