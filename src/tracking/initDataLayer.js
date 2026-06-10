/* ============================================================
   PRINCE AEP LAB — DATA LAYER v5
   Architecture : Adobe Client Data Layer (ACDL) — Push Pattern
   Tenant NS    : _aepsupport  (replace with your AEP tenant ID)
   Schema ver   : 1.0
   ============================================================

   WHAT CHANGED FROM v4 AND WHY
   ─────────────────────────────────────────────────────────────
   ❌ v4 problems fixed in v5:

   1. window.dataLayer (object mutation)
      → window.adobeDataLayer (ACDL push array)
      WHY: Launch cannot listen to object mutations. ACDL push
      is what the "Adobe Client Data Layer" Launch extension
      listens to. Every push is immutable — events never
      overwrite each other.

   2. window._satellite.track() called from app code
      → Completely removed from app code
      WHY: React code should not know Adobe Launch exists.
      Launch reacts to ACDL pushes on its own. This is
      decoupling — the entire value of using a TMS.

   3. timestamp: Date.now()  (integer milliseconds)
      → timestamp: new Date().toISOString()  (ISO 8601 string)
      WHY: AEP Edge Network requires ISO 8601 UTC strings.
      Integer timestamps cause ingestion parsing errors.

   4. commerce flags set to null when not relevant
      → commerce flags OMITTED when not relevant
      WHY: XDM schema: absent = "not applicable".
      null = "explicitly unknown" → validation warnings in AEP.

   5. _prince namespace (inconsistent placeholder)
      → _aepsupport (consistent everywhere)
      WHY: One find-and-replace when setting up your AEP sandbox.

   6. No identityMap on events
      → identityMap on EVERY push
      WHY: RTCDP cannot stitch ECID to email without identityMap.
      Without stitching, AJO journeys find no profile.

   7. No eventType field
      → eventType on every push
      WHY: Required by XDM Experience Event schema. CJA uses it
      to map events to standard commerce dimensions.

   8. No session tracking
      → sessionId, entryPage, deviceType, UTM on every push
      WHY: CJA needs sessions for funnel analysis. AJO needs
      sessionId for "abandoned this session" triggers. UTM
      gives you acquisition dimensions in CJA from day one.

   9. No firstSeenAt / sessionCount / loginMethod
      → Added to _aepsupport.user
      WHY: RTCDP lifecycle segments. AJO conditions like
      "visited 3+ times, never purchased".

   10. No pageCategory / previousPage
       → Added to _aepsupport.page
       WHY: CJA navigation and section-level analysis.

   11. No ECID as explicit field (v5.1 addition)
       → _aepsupport.ecid on every push
       WHY: identityMap holds ECID for profile stitching but
       is a complex map type — CJA cannot use it as a plain
       dimension. _aepsupport.ecid is a simple string field
       that CJA can surface as a draggable dimension for
       unique visitor counts, session breakdowns, and
       cross-device journey analysis.

   ─────────────────────────────────────────────────────────────
   HOW ACDL WORKS
   ─────────────────────────────────────────────────────────────
   1  React handler fires → calls e.g. pushAddToCartEvent()
   2  This file pushes complete object to window.adobeDataLayer
   3  ACDL extension in Launch detects the push
   4  Launch rule triggers: event = "add_to_cart"
   5  Launch data elements read from adobeDataLayer.getState()
   6  Launch builds XDM object from data elements
   7  Web SDK sendEvent() → AEP Edge Network
   8  Edge → AEP Dataset → RTCDP profile → CJA → AJO

   React code NEVER calls _satellite or alloy directly.
   Exception: getECID() calls alloy("getIdentity") once to
   read the ECID assigned by Web SDK, then caches it.

   ─────────────────────────────────────────────────────────────
   TENANT NAMESPACE: _aepsupport
   ─────────────────────────────────────────────────────────────
   Custom field group in AEP Schema Registry:
   "Prince AEP Lab - Custom Fields"

   _aepsupport
     ├── page        { pageType, pageCategory, previousPage, viewport }
     ├── user        { isLoggedIn, loginState, authId, authNamespace,
     │                 loginMethod, firstSeenAt, sessionCount }
     ├── session     { id, startTime, entryPage, deviceType, utm{} }
     ├── ecid        string — ECID as a plain CJA-reportable dimension
     └── feedback    { rating, feedbackLength, pageContext }

   Inside productListItems[]:
     _aepsupport   { unitPrice, category, rating }

   FIND & REPLACE before AEP setup:
     _aepsupport  →  your actual AEP tenant identifier
   ============================================================ */


/* ============================================================
   SECTION 1 — CONSTANTS
   ============================================================ */

/* ACDL event trigger keys — Launch rule conditions listen for these strings. */
export const EVENT_NAMES = {
  PAGE_VIEW:          "page_view",
  VIEW_ITEM:          "view_item",
  ADD_TO_CART:        "add_to_cart",
  REMOVE_FROM_CART:   "remove_from_cart",
  VIEW_CART:          "view_cart",
  BEGIN_CHECKOUT:     "begin_checkout",
  PURCHASE:           "purchase",
  CHECKOUT_CLICK:     "checkout_click",
  LOGIN:              "login",
  LOGOUT:             "logout",
  FEEDBACK_SUBMITTED: "feedback_submitted",
  EXIT_INTENT:        "exit_intent",
};

/* XDM eventType strings — required by AEP schema, used by CJA for standard commerce metrics. */
export const EVENT_TYPES = {
  PAGE_VIEW:          "web.webpagedetails.pageViews",
  VIEW_ITEM:          "commerce.productViews",
  ADD_TO_CART:        "commerce.productListAdds",
  REMOVE_FROM_CART:   "commerce.productListRemovals",
  VIEW_CART:          "commerce.productListViews",
  BEGIN_CHECKOUT:     "commerce.checkouts",
  PURCHASE:           "commerce.purchases",
  CHECKOUT_CLICK:     "web.webInteraction.linkClicks",
  LOGIN:              "userAccount.login",
  LOGOUT:             "userAccount.logout",
  FEEDBACK_SUBMITTED: "web.formFilledOut",
  EXIT_INTENT:        "web.webInteraction.linkClicks",
};

/* Route → pageType/pageCategory map. Used by PageTracker on every route change. */
export const PAGE_META = {
  "/":             { pageType: "home",              pageCategory: "acquisition" },
  "/products":     { pageType: "product_list",       pageCategory: "commerce"   },
  "/cart":         { pageType: "cart",               pageCategory: "commerce"   },
  "/checkout":     { pageType: "checkout",           pageCategory: "commerce"   },
  "/login":        { pageType: "login",              pageCategory: "account"    },
  "/confirmation": { pageType: "order_confirmation", pageCategory: "commerce"   },
};

/* Product detail pages match /product/* — handled separately from PAGE_META. */
export const PRODUCT_DETAIL_META = {
  pageType:     "product_detail",
  pageCategory: "commerce",
};


/* ============================================================
   SECTION 2 — PRIVATE UTILITY FUNCTIONS
   Not exported. Used only within this file.
   ============================================================ */

/* Returns current time as ISO 8601 UTC string — required format by AEP Edge. */
const getTimestamp = () => new Date().toISOString();

/* Detects device type from userAgent. Returns "mobile" | "tablet" | "desktop". */
const getDeviceType = () => {
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/.test(ua)) return "mobile";
  return "desktop";
};

/*
  Reads UTM params from the current URL.
  Persists them in sessionStorage so attribution survives internal SPA navigation.
  Falls back to sessionStorage if no UTMs are present in the current URL.
*/
const UTM_STORAGE_KEY = "aep_utm";

const getUTMParams = () => {
  const params = new URLSearchParams(window.location.search);

  const fromURL = {
    source:   params.get("utm_source")   || null,
    medium:   params.get("utm_medium")   || null,
    campaign: params.get("utm_campaign") || null,
    term:     params.get("utm_term")     || null,
    content:  params.get("utm_content")  || null,
  };

  const hasUTMs = Object.values(fromURL).some(Boolean);

  if (hasUTMs) {
    try { sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(fromURL)); } catch { /* silent */ }
    return fromURL;
  }

  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* silent */ }

  return { source: null, medium: null, campaign: null, term: null, content: null };
};

const SESSION_ID_KEY    = "aep_session_id";
const SESSION_ENTRY_KEY = "aep_session_entry";
const SESSION_START_KEY = "aep_session_start";

/* Returns existing session ID or generates a new one. Resets when the tab closes. */
const getSessionId = () => {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
};

/* Returns the first page pathname visited this session. Written once, never overwritten. */
const getSessionEntryPage = () => {
  let entry = sessionStorage.getItem(SESSION_ENTRY_KEY);
  if (!entry) {
    entry = window.location.pathname;
    sessionStorage.setItem(SESSION_ENTRY_KEY, entry);
  }
  return entry;
};

/*
  Reads and updates persistent user meta from localStorage.
  firstSeenAt  — written once on first ever visit, never overwritten.
  sessionCount — incremented once per new browser session (tab close → reopen).
*/
const USER_META_KEY = "aep_user_meta";

const getUserMeta = () => {
  try {
    const stored    = localStorage.getItem(USER_META_KEY);
    const meta      = stored ? JSON.parse(stored) : null;
    const now       = getTimestamp();
    const isNewSess = !sessionStorage.getItem(SESSION_ID_KEY);

    if (!meta) {
      const initial = { firstSeenAt: now, sessionCount: 1 };
      localStorage.setItem(USER_META_KEY, JSON.stringify(initial));
      return initial;
    }

    if (isNewSess) {
      const updated = {
        firstSeenAt:  meta.firstSeenAt,
        sessionCount: (meta.sessionCount || 1) + 1,
      };
      localStorage.setItem(USER_META_KEY, JSON.stringify(updated));
      return updated;
    }

    return meta;
  } catch {
    return { firstSeenAt: getTimestamp(), sessionCount: 1 };
  }
};

/* Reads auth state from localStorage — survives page refreshes. */
const getAuthState = () => {
  try {
    const stored = localStorage.getItem("ECOM_AUTH_USER");
    if (stored) {
      const auth = JSON.parse(stored);
      if (auth?.isAuthenticated && auth?.email) {
        return { email: auth.email, isAuthenticated: true };
      }
    }
  } catch { /* silent */ }
  return { email: null, isAuthenticated: false };
};

/*
  Builds XDM-compliant identityMap for a given email.
  ECID is intentionally NOT set here — Web SDK manages it automatically.
  Setting ECID here would conflict with Web SDK's identity cookie management.
  authenticatedState: "authenticated" is what triggers RTCDP identity stitching.
*/
const buildIdentityMap = (email, authenticatedState = "ambiguous") => {
  if (!email) return {};
  return {
    Email: [
      {
        id:                 email,
        authenticatedState: authenticatedState,
        primary:            false,
      },
    ],
  };
};

/* Returns identityMap for the current visitor based on stored auth state. */
const getCurrentIdentityMap = () => {
  const { email, isAuthenticated } = getAuthState();
  return buildIdentityMap(email, isAuthenticated ? "authenticated" : "ambiguous");
};

/* Builds _aepsupport.user — merges live auth state with persisted firstSeenAt/sessionCount. */
const buildUserContext = (overrides = {}) => {
  const { email, isAuthenticated } = getAuthState();
  const meta = getUserMeta();
  return {
    isLoggedIn:    isAuthenticated,
    loginState:    isAuthenticated ? "authenticated" : "ambiguous",
    authId:        email  || null,
    authNamespace: isAuthenticated ? "Email" : null,
    loginMethod:   isAuthenticated ? "email" : null,
    firstSeenAt:   meta.firstSeenAt,
    sessionCount:  meta.sessionCount,
    ...overrides,
  };
};

/* Builds _aepsupport.session — sessionId, entryPage, deviceType, UTM params. */
const buildSessionContext = () => ({
  id:         getSessionId(),
  startTime:  sessionStorage.getItem(SESSION_START_KEY) || getTimestamp(),
  entryPage:  getSessionEntryPage(),
  deviceType: getDeviceType(),
  utm:        getUTMParams(),
});

/* Builds _aepsupport.page — pageType, pageCategory, previousPage, viewport dimensions. */
const buildPageContext = (pageType, pageCategory, previousPage = null) => ({
  pageType:     pageType     || "other",
  pageCategory: pageCategory || "other",
  previousPage: previousPage || null,
  viewport: {
    width:  window.innerWidth,
    height: window.innerHeight,
  },
});

/*
  Normalizes Redux cartItems into two formats:
  normalizedItems    — deduplicated internal snapshot (id, name, price, quantity, etc.)
  productListItems   — XDM-compliant array (SKU, name, priceTotal, quantity, currencyCode)
  Both are sent on cart/checkout/purchase events for CJA per-product row expansion.
*/
const buildCartData = (items = []) => {
  const map = {};
  items.forEach((item) => {
    const id = String(item.id);
    if (!map[id]) {
      map[id] = {
        id,
        name:     item.title    || item.name,
        category: item.category || null,
        price:    item.price,
        quantity: item.quantity,
        rating:   item.rating?.rate || item.rating || null,
      };
    } else {
      map[id].quantity += item.quantity;
    }
  });

  const normalizedItems = Object.values(map);

  const productListItems = normalizedItems.map((item) => ({
    SKU:          item.id,
    name:         item.name,
    priceTotal:   parseFloat((item.price * item.quantity).toFixed(2)),
    quantity:     item.quantity,
    currencyCode: "USD",
    _aepsupport: {
      unitPrice: item.price,
      category:  item.category || null,
      rating:    item.rating   || null,
    },
  }));

  return { normalizedItems, productListItems };
};

/* Sums total item quantity across all cart items. */
const sumQty = (items) =>
  items.reduce((s, i) => s + i.quantity, 0);

/* Sums total cart value (price × quantity per item), rounded to 2 decimal places. */
const sumVal = (items) =>
  parseFloat(items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2));


/* ============================================================
   SECTION 3 — ECID HELPER
   Reads the ECID assigned by Web SDK via alloy("getIdentity").
   Cached after the first call — subsequent calls return instantly.
   Used to populate _aepsupport.ecid as a plain string field
   so CJA can use ECID as a reportable dimension (identityMap
   is a complex type that CJA cannot surface as a dimension).

   WHY THE WAIT:
   Launch loads async — window.alloy does not exist at the moment
   React mounts and fires the first page_view. Without waiting,
   the getIdentity call throws and returns null every time.
   We poll up to 4 seconds for window.alloy to become a function,
   then make the call. After the first successful read the ECID
   is cached, so every subsequent push resolves instantly.
   ============================================================ */

let cachedECID = null;

const waitForAlloy = (maxWaitMs = 4000) =>
  new Promise((resolve) => {
    if (typeof window.alloy === "function") return resolve(true);
    const start    = Date.now();
    const interval = setInterval(() => {
      if (typeof window.alloy === "function") {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - start >= maxWaitMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 100);
  });

export const getECID = async () => {
  if (cachedECID) return cachedECID;
  const ready = await waitForAlloy();
  if (!ready) {
    console.warn("[ACDL] getECID: alloy not available after 4s — ECID skipped");
    return null;
  }
  try {
    const result = await window.alloy("getIdentity", { namespaces: ["ECID"] });
    cachedECID = result?.identity?.ECID?.[0]?.id || null;
    return cachedECID;
  } catch (e) {
    console.warn("[ACDL] getECID: getIdentity failed —", e?.message);
    return null;
  }
};


/* ============================================================
   SECTION 4 — INITIALIZER
   Call ONCE in index.js BEFORE ReactDOM.createRoot().render()
   ============================================================ */

/*
  Sets up window.adobeDataLayer and pushes the baseline state snapshot.
  This push has NO "event" key — it is state only, Launch fires no rules from it.
  Records session start time once. Logs init summary to console.
*/
export const initDataLayer = () => {
  window.adobeDataLayer = window.adobeDataLayer || [];

  if (!sessionStorage.getItem(SESSION_START_KEY)) {
    sessionStorage.setItem(SESSION_START_KEY, getTimestamp());
  }

  window.adobeDataLayer.push({
    _aepsupport: {
      user:    buildUserContext(),
      session: buildSessionContext(),
    },
    identityMap: getCurrentIdentityMap(),
    cart: {
      items:         [],
      totalQuantity: 0,
      totalValue:    0,
      currency:      "USD",
    },
    meta: {
      environment:      process.env.NODE_ENV === "production" ? "prod" : "dev",
      appVersion:       "2.0.0",
      trackingVersion:  "aep-v5-acdl",
      tenantNamespace:  "_aepsupport",
    },
    consent: {
      standard: "Adobe",
      version:  "2.0",
      value: {
        general: "in",
      },
    },
  });

  console.groupCollapsed(
    "%c✅ AEP ACDL v5 initialized",
    "color:#10B981;font-weight:bold;font-size:13px;"
  );
  console.log("session  →", buildSessionContext());
  console.log("user     →", buildUserContext());
  console.log("identity →", getCurrentIdentityMap());
  console.groupEnd();
};


/* ============================================================
   SECTION 5 — EVENT PUSH FUNCTIONS

   Every push contains:
     event        → ACDL trigger string (Launch rule listens for this)
     eventType    → XDM standard string (required by schema)
     timestamp    → ISO 8601 UTC (required by AEP Edge)
     identityMap  → RTCDP identity stitching (on every push)
     _aepsupport  → custom fields: page, user, session, ecid
   + event-specific: web, commerce, productListItems, cart
   ============================================================ */


/* ─────────────────────────────────────────────────────────────
   pushPageViewEvent — fires on every SPA route change.
   Captures page name, URL, type, category, referrer, identity,
   UTM attribution, and ECID. Called by PageTracker.js.
   ───────────────────────────────────────────────────────────── */
export const pushPageViewEvent = async ({
  pageName,
  pageType,
  pageCategory,
  pageUrl,
  previousPageUrl,
}) => {
  const ecid = await getECID();

  const push = {
    event:     EVENT_NAMES.PAGE_VIEW,
    eventType: EVENT_TYPES.PAGE_VIEW,

    web: {
      webPageDetails: {
        name:      pageName,
        URL:       pageUrl || window.location.pathname,
        pageViews: { value: 1 },
      },
      webReferrer: {
        /*
          For SPA internal navigation, document.referrer is always
          the domain root — use previousPageUrl from PageTracker.
          document.referrer is only useful on the very first page load.
        */
        URL: previousPageUrl || document.referrer || null,
      },
    },

    _aepsupport: {
      page:    buildPageContext(pageType, pageCategory, previousPageUrl),
      user:    buildUserContext(),
      session: buildSessionContext(),
      ecid,
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c📘 page_view",
    "color:#3B82F6;font-weight:bold;",
    `| ${pageType} (${pageCategory}) | ${pageUrl}`,
    "\n  identity →", push.identityMap,
    "\n  ecid     →", ecid,
    "\n  utm      →", push._aepsupport.session.utm
  );
};


/* ─────────────────────────────────────────────────────────────
   pushViewItemEvent — fires when a product detail page loads.
   Captures SKU, name, price, category, rating, and ECID.
   Called by ProductDetail.js after API fetch completes.
   ───────────────────────────────────────────────────────────── */
export const pushViewItemEvent = async (product) => {
  const ecid = await getECID();

  const productListItems = [
    {
      SKU:          String(product.id),
      name:         product.name,
      priceTotal:   product.price,
      quantity:     1,
      currencyCode: "USD",
      _aepsupport: {
        unitPrice: product.price,
        category:  product.category || null,
        rating:    product.rating   || null,
      },
    },
  ];

  const push = {
    event:     EVENT_NAMES.VIEW_ITEM,
    eventType: EVENT_TYPES.VIEW_ITEM,

    commerce: {
      productViews: { value: 1 },
    },

    productListItems,

    web: {
      webPageDetails: {
        name: product.name,
        URL:  window.location.pathname,
      },
    },

    _aepsupport: {
      page:    buildPageContext(
        PRODUCT_DETAIL_META.pageType,
        PRODUCT_DETAIL_META.pageCategory
      ),
      user:    buildUserContext(),
      session: buildSessionContext(),
      ecid,
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c👁️  view_item",
    "color:#8B5CF6;font-weight:bold;",
    `| SKU: ${product.id} | ${product.name}`,
    "\n  productListItems →", productListItems,
    "\n  ecid             →", ecid,
    "\n  identity         →", push.identityMap
  );
};


/* ─────────────────────────────────────────────────────────────
   pushAddToCartEvent — fires when a product is added to cart.
   productListItems = full cart state AFTER the add.
   Called by Product.js and ProductDetail.js.
   ───────────────────────────────────────────────────────────── */
export const pushAddToCartEvent = async ({ product, cart }) => {
  if (!cart?.items) {
    console.warn("[ACDL] pushAddToCartEvent: cart.items missing — push skipped");
    return;
  }

  const ecid = await getECID();
  const { normalizedItems, productListItems } = buildCartData(cart.items);
  const isOnDetailPage = window.location.pathname.startsWith("/product/");

  const push = {
    event:     EVENT_NAMES.ADD_TO_CART,
    eventType: EVENT_TYPES.ADD_TO_CART,

    commerce: {
      productListAdds: { value: 1 },
    },

    productListItems,

    cart: {
      items:         normalizedItems,
      totalQuantity: sumQty(normalizedItems),
      totalValue:    sumVal(normalizedItems),
      currency:      "USD",
    },

    web: {
      webPageDetails: {
        name: isOnDetailPage ? "Product Detail" : "Product List",
        URL:  window.location.pathname,
      },
    },

    _aepsupport: {
      page: buildPageContext(
        isOnDetailPage ? PRODUCT_DETAIL_META.pageType : "product_list",
        "commerce"
      ),
      user:    buildUserContext(),
      session: buildSessionContext(),
      ecid,
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c🛒 add_to_cart",
    "color:#10B981;font-weight:bold;",
    `| SKU: ${product.id} | cart: $${push.cart.totalValue}`,
    "\n  productListItems →", productListItems,
    "\n  ecid             →", ecid,
    "\n  identity         →", push.identityMap
  );
};


/* ─────────────────────────────────────────────────────────────
   pushRemoveFromCartEvent — fires when a product is removed from cart.
   productListItems = cart state AFTER removal (removed item absent).
   Called by Cart.js on trash icon click.
   ───────────────────────────────────────────────────────────── */
export const pushRemoveFromCartEvent = async ({ product, cart }) => {
  const ecid = await getECID();
  const { normalizedItems, productListItems } = buildCartData(cart?.items || []);

  const push = {
    event:     EVENT_NAMES.REMOVE_FROM_CART,
    eventType: EVENT_TYPES.REMOVE_FROM_CART,

    commerce: {
      productListRemovals: { value: 1 },
    },

    productListItems,

    cart: {
      items:         normalizedItems,
      totalQuantity: sumQty(normalizedItems),
      totalValue:    sumVal(normalizedItems),
      currency:      "USD",
    },

    web: {
      webPageDetails: {
        name: "Cart",
        URL:  window.location.pathname,
      },
      webInteraction: {
        name: `Removed: ${product.title || product.name}`,
        type: "other",
      },
    },

    _aepsupport: {
      page:    buildPageContext("cart", "commerce"),
      user:    buildUserContext(),
      session: buildSessionContext(),
      ecid,
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c🗑️  remove_from_cart",
    "color:#EF4444;font-weight:bold;",
    `| SKU: ${product.id} | remaining: ${normalizedItems.length} items`,
    "\n  productListItems →", productListItems,
    "\n  ecid             →", ecid
  );
};


/* ─────────────────────────────────────────────────────────────
   pushViewCartEvent — fires when the Cart page mounts with items.
   Captures full cart contents for CJA cart abandonment analysis.
   Called by Cart.js useEffect.
   ───────────────────────────────────────────────────────────── */
export const pushViewCartEvent = async (reduxCart) => {
  if (!reduxCart?.cartItems) {
    console.warn("[ACDL] pushViewCartEvent: cartItems missing — push skipped");
    return;
  }

  const ecid = await getECID();
  const { normalizedItems, productListItems } = buildCartData(reduxCart.cartItems);

  const push = {
    event:     EVENT_NAMES.VIEW_CART,
    eventType: EVENT_TYPES.VIEW_CART,

    commerce: {
      productListViews: { value: 1 },
    },

    productListItems,

    cart: {
      items:         normalizedItems,
      totalQuantity: sumQty(normalizedItems),
      totalValue:    sumVal(normalizedItems),
      currency:      "USD",
    },

    web: {
      webPageDetails: {
        name: "Cart",
        URL:  window.location.pathname,
      },
    },

    _aepsupport: {
      page:    buildPageContext("cart", "commerce"),
      user:    buildUserContext(),
      session: buildSessionContext(),
      ecid,
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c👀 view_cart",
    "color:#F59E0B;font-weight:bold;",
    `| ${normalizedItems.length} items | $${push.cart.totalValue}`,
    "\n  productListItems →", productListItems,
    "\n  ecid             →", ecid
  );
};


/* ─────────────────────────────────────────────────────────────
   pushBeginCheckoutEvent — fires when Checkout page mounts.
   Always authenticated (Cart redirects guests to Login first).
   Captures full cart at checkout start for funnel analysis.
   Called by Checkout.js useEffect.
   ───────────────────────────────────────────────────────────── */
export const pushBeginCheckoutEvent = async (reduxCart) => {
  if (!reduxCart?.cartItems) {
    console.warn("[ACDL] pushBeginCheckoutEvent: cartItems missing — push skipped");
    return;
  }

  const ecid = await getECID();
  const { normalizedItems, productListItems } = buildCartData(reduxCart.cartItems);

  const push = {
    event:     EVENT_NAMES.BEGIN_CHECKOUT,
    eventType: EVENT_TYPES.BEGIN_CHECKOUT,

    commerce: {
      checkouts: { value: 1 },
    },

    productListItems,

    cart: {
      items:         normalizedItems,
      totalQuantity: sumQty(normalizedItems),
      totalValue:    sumVal(normalizedItems),
      currency:      "USD",
    },

    web: {
      webPageDetails: {
        name: "Checkout",
        URL:  window.location.pathname,
      },
    },

    _aepsupport: {
      page:    buildPageContext("checkout", "commerce"),
      user:    buildUserContext(),
      session: buildSessionContext(),
      ecid,
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c💳 begin_checkout",
    "color:#6366F1;font-weight:bold;",
    `| ${normalizedItems.length} items | $${push.cart.totalValue}`,
    "\n  productListItems →", productListItems,
    "\n  ecid             →", ecid,
    "\n  identity         →", push.identityMap
  );
};


/* ─────────────────────────────────────────────────────────────
   pushCheckoutClickEvent — fires when "Proceed to Checkout" is clicked.
   UI interaction event — no commerce flag.
   CJA: checkout_click ÷ view_cart = checkout button CTR.
   Called by Cart.js on button click.
   ───────────────────────────────────────────────────────────── */
export const pushCheckoutClickEvent = async () => {
  const ecid = await getECID();

  const push = {
    event:     EVENT_NAMES.CHECKOUT_CLICK,
    eventType: EVENT_TYPES.CHECKOUT_CLICK,

    web: {
      webPageDetails: {
        name: "Cart",
        URL:  window.location.pathname,
      },
      webInteraction: {
        name:       "Proceed to Checkout",
        type:       "other",
        linkClicks: { value: 1 },
      },
    },

    _aepsupport: {
      page:    buildPageContext("cart", "commerce"),
      user:    buildUserContext(),
      session: buildSessionContext(),
      ecid,
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c🖱️  checkout_click",
    "color:#64748B;font-weight:bold;",
    "\n  ecid →", ecid,
    "\n  web  →", push.web
  );
};


/* ─────────────────────────────────────────────────────────────
   pushPurchaseEvent — fires when "Place Order" is clicked.
   ⚠️  Must fire BEFORE dispatch(clearCart()) — cart is empty after.
   Sends purchaseID (UUID) for AEP deduplication.
   productListItems = everything purchased — CJA expands per product.
   Called by Checkout.js handlePayment().
   ───────────────────────────────────────────────────────────── */
export const pushPurchaseEvent = async ({ cart, orderId }) => {
  if (!cart?.cartItems) {
    console.warn("[ACDL] pushPurchaseEvent: cartItems missing — push skipped");
    return;
  }

  const ecid = await getECID();
  const { normalizedItems, productListItems } = buildCartData(cart.cartItems);
  const totalValue = sumVal(normalizedItems);

  const push = {
    event:     EVENT_NAMES.PURCHASE,
    eventType: EVENT_TYPES.PURCHASE,

    commerce: {
      purchases: { value: 1 },
      order: {
        purchaseID:   orderId,
        priceTotal:   totalValue,
        currencyCode: "USD",
      },
    },

    productListItems,

    cart: {
      items:         normalizedItems,
      totalQuantity: sumQty(normalizedItems),
      totalValue,
      currency:      "USD",
    },

    transaction: {
      orderId,
      revenue:  totalValue,
      currency: "USD",
    },

    web: {
      webPageDetails: {
        name: "Checkout",
        URL:  window.location.pathname,
      },
    },

    _aepsupport: {
      page:    buildPageContext("checkout", "commerce"),
      user:    buildUserContext(),
      session: buildSessionContext(),
      ecid,
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c✅ purchase",
    "color:#10B981;font-weight:bold;font-size:14px;",
    `| orderId: ${orderId} | revenue: $${totalValue}`,
    "\n  commerce         →", push.commerce,
    "\n  productListItems →", productListItems,
    "\n  ecid             →", ecid,
    "\n  identity         →", push.identityMap
  );
};


/* ─────────────────────────────────────────────────────────────
   pushLoginEvent — fires after successful email login.
   ⚠️  Most critical push for RTCDP identity stitching.
   identityMap.Email with authenticatedState "authenticated"
   tells AEP Edge to link this ECID to this Email in the
   identity graph — merging anonymous + known profiles into one.
   Called by Login.js after login() succeeds.
   ───────────────────────────────────────────────────────────── */
export const pushLoginEvent = async (email) => {
  if (!email) {
    console.warn("[ACDL] pushLoginEvent: email missing — push skipped");
    return;
  }

  const ecid = await getECID();
  const meta = getUserMeta();

  const push = {
    event:     EVENT_NAMES.LOGIN,
    eventType: EVENT_TYPES.LOGIN,

    identityMap: buildIdentityMap(email, "authenticated"),

    web: {
      webPageDetails: {
        name: "Login",
        URL:  window.location.pathname,
      },
    },

    _aepsupport: {
      page: buildPageContext("login", "account"),
      user: {
        isLoggedIn:    true,
        loginState:    "authenticated",
        authId:        email,
        authNamespace: "Email",
        loginMethod:   "email",
        firstSeenAt:   meta.firstSeenAt,
        sessionCount:  meta.sessionCount,
      },
      session: buildSessionContext(),
      ecid,
    },

    timestamp: getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c🔐 login",
    "color:#10B981;font-weight:bold;",
    `| ${email}`,
    "\n  identityMap →", push.identityMap,
    "\n  ecid        →", ecid,
    "\n  user        →", push._aepsupport.user
  );
};


/* ─────────────────────────────────────────────────────────────
   pushLogoutEvent — fires when user clicks Logout in Navbar.
   Derives page context dynamically from window.location.pathname
   so CJA can report which page users log out from most.
   identityMap is empty — no identity to assert after logout.
   Called by AuthContext.js logout() BEFORE clearing localStorage.
   ───────────────────────────────────────────────────────────── */
export const pushLogoutEvent = async () => {
  const ecid     = await getECID();
  const meta     = getUserMeta();
  const pathname = window.location.pathname;

  const currentMeta = PAGE_META[pathname] || {
    pageType:     "product_detail",
    pageCategory: "commerce",
  };

  const currentPageName = (() => {
    if (pathname === "/")             return "Home";
    if (pathname === "/products")     return "Products";
    if (pathname === "/cart")         return "Cart";
    if (pathname === "/checkout")     return "Checkout";
    if (pathname === "/confirmation") return "Order Confirmation";
    if (pathname === "/login")        return "Login";
    if (pathname.startsWith("/product/")) return "Product Detail";
    return pathname.replace(/^\//, "").replace(/-/g, " ");
  })();

  const push = {
    event:     EVENT_NAMES.LOGOUT,
    eventType: EVENT_TYPES.LOGOUT,

    identityMap: {},

    web: {
      webPageDetails: {
        name: currentPageName,
        URL:  pathname,
      },
    },

    _aepsupport: {
      page: buildPageContext(currentMeta.pageType, currentMeta.pageCategory),
      user: {
        isLoggedIn:    false,
        loginState:    "loggedOut",
        authId:        null,
        authNamespace: null,
        loginMethod:   null,
        firstSeenAt:   meta.firstSeenAt,
        sessionCount:  meta.sessionCount,
      },
      session: buildSessionContext(),
      ecid,
    },

    cart: {
      items:         [],
      totalQuantity: 0,
      totalValue:    0,
      currency:      "USD",
    },

    timestamp: getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c🔓 logout",
    "color:#EF4444;font-weight:bold;",
    `| from: ${currentPageName} (${pathname})`,
    "\n  ecid        →", ecid,
    "\n  identityMap →", push.identityMap,
    "\n  user        →", push._aepsupport.user
  );
};


/* ─────────────────────────────────────────────────────────────
   pushFeedbackSubmittedEvent — fires when order confirmation feedback is submitted.
   Captures star rating and feedback character count.
   CJA: correlate satisfaction scores with order value, category, UTM source.
   Called by OrderConfirmation.js on form submit.
   ───────────────────────────────────────────────────────────── */
export const pushFeedbackSubmittedEvent = async ({ rating, feedbackLength }) => {
  const ecid = await getECID();

  const push = {
    event:     EVENT_NAMES.FEEDBACK_SUBMITTED,
    eventType: EVENT_TYPES.FEEDBACK_SUBMITTED,

    web: {
      webPageDetails: {
        name: "Order Confirmation",
        URL:  window.location.pathname,
      },
      webInteraction: {
        name: "Submit Feedback",
        type: "other",
      },
    },

    _aepsupport: {
      page: buildPageContext("order_confirmation", "commerce"),
      feedback: {
        rating:         rating         || null,
        feedbackLength: feedbackLength || 0,
        pageContext:    "order_confirmation",
      },
      user:    buildUserContext(),
      session: buildSessionContext(),
      ecid,
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c📝 feedback_submitted",
    "color:#8B5CF6;font-weight:bold;",
    `| rating: ${rating} | length: ${feedbackLength}`,
    "\n  ecid     →", ecid,
    "\n  feedback →", push._aepsupport.feedback
  );
};


/* ─────────────────────────────────────────────────────────────
   pushExitIntentEvent — fires when user moves mouse toward browser chrome on Home page.
   AJO use case: exit intent → no purchase in session → send re-engagement push.
   Called by Home.js on mouseleave with upward velocity.
   ───────────────────────────────────────────────────────────── */
export const pushExitIntentEvent = async () => {
  const ecid = await getECID();

  const push = {
    event:     EVENT_NAMES.EXIT_INTENT,
    eventType: EVENT_TYPES.EXIT_INTENT,

    web: {
      webPageDetails: {
        name: "Home",
        URL:  window.location.pathname,
      },
      webInteraction: {
        name:       "Exit Intent",
        type:       "other",
        linkClicks: { value: 1 },
      },
    },

    _aepsupport: {
      page:    buildPageContext("home", "acquisition"),
      user:    buildUserContext(),
      session: buildSessionContext(),
      ecid,
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c🚪 exit_intent",
    "color:#F59E0B;font-weight:bold;",
    "\n  ecid    →", ecid,
    "\n  session →", push._aepsupport.session
  );
};
