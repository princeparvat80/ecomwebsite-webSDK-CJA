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
     └── feedback    { rating, feedbackLength, pageContext }

   Inside productListItems[]:
     _aepsupport   { unitPrice, category, rating }

   FIND & REPLACE before AEP setup:
     _aepsupport  →  your actual AEP tenant identifier
   ============================================================ */


/* ============================================================
   SECTION 1 — CONSTANTS
   ============================================================ */

/*
  EVENT_NAMES — the "event" key in every ACDL push.
  The Launch "Adobe Client Data Layer" extension listens for
  these exact strings as rule triggers.
*/
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

/*
  EVENT_TYPES — the "eventType" key in every ACDL push.
  These are XDM standard strings. Required by AEP schema.
  CJA uses these to populate standard commerce metrics.
  Launch maps these into xdm.eventType.
*/
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

/*
  PAGE_META — maps every route pathname to its pageType and pageCategory.
  Used by PageTracker.js when calling pushPageViewEvent().

  pageType     → fine-grained CJA dimension (custom field group)
  pageCategory → section grouping for AJO journey entry conditions
                 e.g. "entered from a commerce page"
*/
export const PAGE_META = {
  "/":             { pageType: "home",              pageCategory: "acquisition" },
  "/products":     { pageType: "product_list",       pageCategory: "commerce"   },
  "/cart":         { pageType: "cart",               pageCategory: "commerce"   },
  "/checkout":     { pageType: "checkout",           pageCategory: "commerce"   },
  "/login":        { pageType: "login",              pageCategory: "account"    },
  "/confirmation": { pageType: "order_confirmation", pageCategory: "commerce"   },
};

/* Product detail pages match /product/* — handled separately */
export const PRODUCT_DETAIL_META = {
  pageType:     "product_detail",
  pageCategory: "commerce",
};


/* ============================================================
   SECTION 2 — PRIVATE UTILITY FUNCTIONS
   Not exported. Used only within this file.
   ============================================================ */

/* Returns ISO 8601 UTC timestamp string — required by AEP Edge */
const getTimestamp = () => new Date().toISOString();

/*
  Detects device type from navigator.userAgent.
  Returns: "mobile" | "tablet" | "desktop"
  Used in _aepsupport.session.deviceType for CJA device analysis
  and AJO journey conditions based on device.
*/
const getDeviceType = () => {
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/.test(ua)) return "mobile";
  return "desktop";
};

/*
  Reads UTM parameters from the current URL.
  Falls back to sessionStorage if no UTMs in current URL so that
  UTM attribution persists across internal page navigations within
  the same session — matching how GA4 handles UTM persistence.

  Stored in sessionStorage (not localStorage) so UTMs reset when
  the session ends. Persisting in localStorage would contaminate
  future sessions with old campaign data.

  Returns: { source, medium, campaign, term, content }
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

/*
  Session ID — generated once per browser session.
  Stored in sessionStorage → resets when tab closes.

  Format: "sess-{timestamp}-{random7chars}"
  Example: "sess-1747390200000-x4k9mzp"

  Used by CJA for visit-level funnel analysis.
  Used by AJO for "abandoned this session" journey triggers.
*/
const SESSION_ID_KEY    = "aep_session_id";
const SESSION_ENTRY_KEY = "aep_session_entry";
const SESSION_START_KEY = "aep_session_start";

const getSessionId = () => {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
};

/* Entry page = first page pathname visited in this session */
const getSessionEntryPage = () => {
  let entry = sessionStorage.getItem(SESSION_ENTRY_KEY);
  if (!entry) {
    entry = window.location.pathname;
    sessionStorage.setItem(SESSION_ENTRY_KEY, entry);
  }
  return entry;
};

/*
  User meta — firstSeenAt and sessionCount.
  Stored in localStorage (persists across sessions).

  firstSeenAt:
    Written ONCE on first ever visit. Never overwritten.
    RTCDP uses this for "new vs returning" audience segments.

  sessionCount:
    Incremented once per session (not per page view).
    New session = SESSION_ID_KEY absent from sessionStorage
    (meaning the tab was closed and reopened).

    AJO journey condition example:
    "sessionCount >= 3 AND no purchase event → send win-back offer"
*/
const USER_META_KEY = "aep_user_meta";

const getUserMeta = () => {
  try {
    const stored   = localStorage.getItem(USER_META_KEY);
    const meta     = stored ? JSON.parse(stored) : null;
    const now      = getTimestamp();
    const isNewSess = !sessionStorage.getItem(SESSION_ID_KEY);

    if (!meta) {
      const initial = { firstSeenAt: now, sessionCount: 1 };
      localStorage.setItem(USER_META_KEY, JSON.stringify(initial));
      return initial;
    }

    if (isNewSess) {
      const updated = {
        firstSeenAt:  meta.firstSeenAt,           /* Never overwrite */
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

/* Reads current auth from localStorage — works after page refreshes */
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
  buildIdentityMap — constructs XDM-compliant identityMap.

  HOW IDENTITY STITCHING WORKS IN RTCDP:
  ─────────────────────────────────────────
  1. Guest arrives → Web SDK auto-assigns ECID (first-party cookie)
  2. User logs in → pushLoginEvent(email) called
  3. That push has identityMap.Email { authenticatedState: "authenticated" }
  4. AEP Edge reads: ECID from Web SDK cookie + Email from identityMap
  5. RTCDP merges anonymous profile (ECID) + known profile (Email)
     into ONE unified real-time profile
  6. All pre-login events are retroactively attributed to known profile
  7. AJO finds the profile by email and enrolls it in journeys

  Rules:
  - primary: false for Email — ECID is ALWAYS primary
  - ECID is NOT set here — Web SDK manages it automatically
  - Setting ECID manually would conflict with Web SDK management

  authenticatedState values (XDM spec):
    "ambiguous"     → guest / auth status unknown
    "authenticated" → actively logged in this session
    "loggedOut"     → actively logged out
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

/* Returns identityMap for current visitor using stored auth state */
const getCurrentIdentityMap = () => {
  const { email, isAuthenticated } = getAuthState();
  return buildIdentityMap(email, isAuthenticated ? "authenticated" : "ambiguous");
};

/*
  buildUserContext — constructs _aepsupport.user for every push.
  Merges live auth state with persisted meta (firstSeenAt, sessionCount).
  The overrides param lets login/logout events set specific fields.
*/
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

/*
  buildSessionContext — constructs _aepsupport.session for every push.
  Reads sessionId, entryPage, deviceType, and UTM params.
*/
const buildSessionContext = () => ({
  id:         getSessionId(),
  startTime:  sessionStorage.getItem(SESSION_START_KEY) || getTimestamp(),
  entryPage:  getSessionEntryPage(),
  deviceType: getDeviceType(),
  utm:        getUTMParams(),
});

/*
  buildPageContext — constructs _aepsupport.page for a given route.
  Used in pushes that know their page context statically.
  For page_view events, PageTracker passes the values explicitly.
*/
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
  buildCartData — normalizes Redux cartItems into two formats.

  normalizedItems → deduplicated internal snapshot
    field names: id, name, category, price, quantity, rating

  productListItems → XDM-compliant array
    Standard XDM fields: SKU, name, priceTotal, quantity, currencyCode
    Custom fields: _aepsupport { unitPrice, category, rating }

  This is what Launch reads and maps to AEP Edge.
  This is what CJA expands per product row.
  This is what AJO reads for abandoned cart messages.
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
    /* XDM standard — do NOT rename these keys */
    SKU:          item.id,
    name:         item.name,
    priceTotal:   parseFloat((item.price * item.quantity).toFixed(2)),
    quantity:     item.quantity,
    currencyCode: "USD",
    /* Custom field group — replace _aepsupport with your tenant ID */
    _aepsupport: {
      unitPrice: item.price,
      category:  item.category || null,
      rating:    item.rating   || null,
    },
  }));

  return { normalizedItems, productListItems };
};

const sumQty = (items) =>
  items.reduce((s, i) => s + i.quantity, 0);

const sumVal = (items) =>
  parseFloat(items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2));


/* ============================================================
   SECTION 3 — INITIALIZER
   Call ONCE in index.js BEFORE ReactDOM.createRoot().render()
   ============================================================ */

/*
  initDataLayer()

  Sets up window.adobeDataLayer as the ACDL array and pushes
  the baseline state snapshot.

  This push has NO "event" key — it is a state snapshot only.
  The ACDL extension will NOT fire any Launch event rules from it.

  window.adobeDataLayer = window.adobeDataLayer || []:
  The ACDL library (loaded by the Launch extension) may load
  before OR after this init runs. The || [] ensures our early
  pushes are queued as plain array entries and replayed correctly
  when ACDL's enhanced push() method loads.
*/

export const initDataLayer = () => {
  window.adobeDataLayer = window.adobeDataLayer || [];

  /* Record session start time once */
  if (!sessionStorage.getItem(SESSION_START_KEY)) {
    sessionStorage.setItem(SESSION_START_KEY, getTimestamp());
  }

  /* Push baseline state — NOT an event (no "event" key) */
  window.adobeDataLayer.push({
    _aepsupport: {
      user: buildUserContext(),
      session: buildSessionContext(),
    },
    identityMap: getCurrentIdentityMap(),
    cart: {
      items: [],
      totalQuantity: 0,
      totalValue: 0,
      currency: "USD",
    },
    meta: {
      environment: process.env.NODE_ENV === "production" ? "prod" : "dev",
      appVersion: "2.0.0",
      trackingVersion: "aep-v5-acdl",
      tenantNamespace: "_aepsupport",
    },
    /* Inside the push({}) in initDataLayer() */
    consent: {
      standard: "Adobe",
      version: "2.0",
      value: {
        general: "in" /* hardcoded consent for sandbox */,
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
   SECTION 4 — EVENT PUSH FUNCTIONS

   EVERY push contains:
     event        → ACDL trigger key (Launch listens for this)
     eventType    → XDM eventType string (required by XDM schema)
     timestamp    → ISO 8601 UTC string (required by AEP Edge)
     identityMap  → RTCDP identity stitching (on every push)
     web          → XDM web context
     _aepsupport → custom field group (page, user, session)
   + event-specific: commerce, productListItems, cart, transaction
   ============================================================ */

/* ─────────────────────────────────────────────────────────────
   pushPageViewEvent
   eventType : web.webpagedetails.pageViews
   Called by : PageTracker.js on every React Router route change

   Standard XDM fields populated:
   web.webPageDetails.name      → CJA "Page Name" dimension
   web.webPageDetails.URL       → CJA "Page URL" dimension
   web.webPageDetails.pageViews → CJA page view METRIC FLAG
   web.webReferrer.URL          → previous URL

   Custom fields (_aepsupport.page):
   pageType     → fine-grained type (CJA custom dimension)
   pageCategory → section grouping (AJO journey entry condition)
   previousPage → navigation path analysis
   viewport     → rendering context
   ───────────────────────────────────────────────────────────── */
export const pushPageViewEvent = ({
  pageName,
  pageType,
  pageCategory,
  pageUrl,
  previousPageUrl,
}) => {
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
          document.referrer is only useful for the very first page
          load (external referrer).
        */
        URL: previousPageUrl || document.referrer || null,
      },
    },

    _aepsupport: {
      page:    buildPageContext(pageType, pageCategory, previousPageUrl),
      user:    buildUserContext(),
      session: buildSessionContext(),
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
    "\n  utm      →", push._aepsupport.session.utm
  );
};


/* ─────────────────────────────────────────────────────────────
   pushViewItemEvent  (replaces: updateProductDataLayer)
   eventType : commerce.productViews
   Called by : ProductDetail.js after product data is fetched

   productListItems has one item — the product being viewed.
   quantity: 1 (not in cart yet, just viewed).
   priceTotal = unitPrice (no quantity multiplier for a view).
   ───────────────────────────────────────────────────────────── */
export const pushViewItemEvent = (product) => {
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
      /*
        All other commerce keys are intentionally OMITTED (not null).
        Omitted = "not applicable". null = "explicitly unknown".
        AEP XDM schema validation treats these differently.
      */
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
    "\n  identity         →", push.identityMap
  );
};


/* ─────────────────────────────────────────────────────────────
   pushAddToCartEvent
   eventType : commerce.productListAdds
   Called by : Product.js, ProductDetail.js

   productListItems = FULL cart state AFTER the add.
   cart snapshot = cart state AFTER the add.
   CJA and AJO always receive the complete cart at point of event.
   ───────────────────────────────────────────────────────────── */
export const pushAddToCartEvent = ({ product, cart }) => {
  if (!cart?.items) {
    console.warn("[ACDL] pushAddToCartEvent: cart.items missing — push skipped");
    return;
  }

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
    "\n  identity         →", push.identityMap
  );
};


/* ─────────────────────────────────────────────────────────────
   pushRemoveFromCartEvent
   eventType : commerce.productListRemovals
   Called by : Cart.js on remove or quantity decrease to 0

   productListItems = cart AFTER removal (removed item not present).
   web.webInteraction.name captures what was removed — useful in
   CJA for "most frequently removed products" analysis.
   ───────────────────────────────────────────────────────────── */
export const pushRemoveFromCartEvent = ({ product, cart }) => {
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
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c🗑️  remove_from_cart",
    "color:#EF4444;font-weight:bold;",
    `| SKU: ${product.id} | remaining: ${normalizedItems.length} items`,
    "\n  productListItems →", productListItems
  );
};


/* ─────────────────────────────────────────────────────────────
   pushViewCartEvent
   eventType : commerce.productListViews
   Called by : Cart.js in useEffect on mount (cart has items)
   ───────────────────────────────────────────────────────────── */
export const pushViewCartEvent = (reduxCart) => {
  if (!reduxCart?.cartItems) {
    console.warn("[ACDL] pushViewCartEvent: cartItems missing — push skipped");
    return;
  }

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
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c👀 view_cart",
    "color:#F59E0B;font-weight:bold;",
    `| ${normalizedItems.length} items | $${push.cart.totalValue}`,
    "\n  productListItems →", productListItems
  );
};


/* ─────────────────────────────────────────────────────────────
   pushBeginCheckoutEvent
   eventType : commerce.checkouts
   Called by : Checkout.js useEffect (after auth confirmed)

   identityMap here always has "authenticated" state because
   Checkout.js redirects unauthenticated users before this fires.
   ───────────────────────────────────────────────────────────── */
export const pushBeginCheckoutEvent = (reduxCart) => {
  if (!reduxCart?.cartItems) {
    console.warn("[ACDL] pushBeginCheckoutEvent: cartItems missing — push skipped");
    return;
  }

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
    "\n  identity         →", push.identityMap
  );
};


/* ─────────────────────────────────────────────────────────────
   pushCheckoutClickEvent
   eventType : web.webInteraction.linkClicks
   Called by : Cart.js when checkout button is clicked

   No commerce flag — this is a UI interaction event.
   CJA: checkout_click / view_cart = checkout button CTR.
   AJO: "clicked checkout but didn't complete" journey trigger.
   ───────────────────────────────────────────────────────────── */
export const pushCheckoutClickEvent = () => {
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
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c🖱️  checkout_click",
    "color:#64748B;font-weight:bold;",
    "\n  web →", push.web
  );
};


/* ─────────────────────────────────────────────────────────────
   pushPurchaseEvent
   eventType : commerce.purchases
   Called by : Checkout.js BEFORE dispatch(clearCart())

   ⚠️  CRITICAL ORDER: Must fire BEFORE Redux clears the cart.
   Once clearCart() runs, cartItems is empty and we lose the
   product data. Checkout.js already does this correctly.

   commerce.order.purchaseID:
   - AEP deduplication: same purchaseID = don't double-ingest
   - AJO entry: "purchase event with purchaseID → post-purchase journey"
   - CJA: order-level revenue and item metrics

   productListItems = everything purchased.
   CJA expands this array into one row per product.
   ───────────────────────────────────────────────────────────── */
export const pushPurchaseEvent = ({ cart, orderId }) => {
  if (!cart?.cartItems) {
    console.warn("[ACDL] pushPurchaseEvent: cartItems missing — push skipped");
    return;
  }

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
    "\n  identity         →", push.identityMap
  );
};


/* ─────────────────────────────────────────────────────────────
   pushLoginEvent
   eventType : userAccount.login
   Called by : Login.js after login() succeeds

   ⚠️  MOST IMPORTANT PUSH FOR RTCDP IDENTITY STITCHING:
   This push carries identityMap.Email with authenticatedState
   "authenticated". When AEP Edge receives this:
   1. Reads ECID from Web SDK's identity cookie
   2. Reads Email from this push's identityMap
   3. Tells RTCDP: these two identities = same person
   4. RTCDP merges anonymous profile (ECID) + known profile (Email)
   5. All pre-login events attributed to the known profile
   6. AJO finds profile by email → enrolls in journeys

   Without this push, RTCDP identity stitching does NOT happen.
   ───────────────────────────────────────────────────────────── */
export const pushLoginEvent = (email) => {
  if (!email) {
    console.warn("[ACDL] pushLoginEvent: email missing — push skipped");
    return;
  }

  const meta = getUserMeta();

  const push = {
    event:     EVENT_NAMES.LOGIN,
    eventType: EVENT_TYPES.LOGIN,

    /* The identity stitch push — "authenticated" triggers RTCDP merge */
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
    },

    timestamp: getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c🔐 login",
    "color:#10B981;font-weight:bold;",
    `| ${email}`,
    "\n  identityMap →", push.identityMap,
    "\n  user        →", push._aepsupport.user
  );
};


/* ─────────────────────────────────────────────────────────────
   pushLogoutEvent
   eventType : userAccount.logout
   Called by : AuthContext.js in logout()

   identityMap is empty on logout — no identity to assert.
   ECID persists in the browser (Web SDK manages it) so future
   anonymous sessions can still be linked to this profile when
   the user logs in again.
   ───────────────────────────────────────────────────────────── */
export const pushLogoutEvent = () => {
  const meta     = getUserMeta();
  const pathname = window.location.pathname;

  /*
    Derive page context from the ACTUAL current page.
    Logout can be triggered from any page via the Navbar —
    hardcoding "Logout" / "home" would misreport the exit page.
    CJA uses this to answer: "From which page do users log out most?"
  */
  const currentMeta = PAGE_META[pathname] || {
    pageType:     "product_detail",
    pageCategory: "commerce",
  };

  /* Derive a readable page name from the pathname */
  const currentPageName = (() => {
    if (pathname === "/")            return "Home";
    if (pathname === "/products")    return "Products";
    if (pathname === "/cart")        return "Cart";
    if (pathname === "/checkout")    return "Checkout";
    if (pathname === "/confirmation") return "Order Confirmation";
    if (pathname === "/login")       return "Login";
    /* product detail: /product/3-mens-cotton-jacket → "Product Detail" */
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
    "\n  identityMap →", push.identityMap,
    "\n  user        →", push._aepsupport.user
  );
};


/* ─────────────────────────────────────────────────────────────
   pushFeedbackSubmittedEvent
   eventType : web.formFilledOut
   Called by : OrderConfirmation.js on feedback submit

   _aepsupport.feedback fields are custom dimensions in CJA.
   Use them to correlate satisfaction scores with:
   - purchase value (high spenders satisfied?)
   - product category (which categories delight customers?)
   - acquisition source (which UTM campaigns bring happy users?)
   ───────────────────────────────────────────────────────────── */
export const pushFeedbackSubmittedEvent = ({ rating, feedbackLength }) => {
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
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c📝 feedback_submitted",
    "color:#8B5CF6;font-weight:bold;",
    `| rating: ${rating} | length: ${feedbackLength}`,
    "\n  feedback →", push._aepsupport.feedback
  );
};


/* ─────────────────────────────────────────────────────────────
   pushExitIntentEvent
   eventType : web.webInteraction.linkClicks
   Called by : Home.js on exit intent trigger (mouseleave)

   AJO use case:
   "Exit intent fired on home → 5 min wait →
    no purchase in session → send re-engagement notification"
   ───────────────────────────────────────────────────────────── */
export const pushExitIntentEvent = () => {
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
    },

    identityMap: getCurrentIdentityMap(),
    timestamp:   getTimestamp(),
  };

  window.adobeDataLayer.push(push);

  console.log(
    "%c🚪 exit_intent",
    "color:#F59E0B;font-weight:bold;",
    "\n  session →", push._aepsupport.session
  );
};