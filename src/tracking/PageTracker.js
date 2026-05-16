import { useEffect, useRef } from "react";
import { useLocation }       from "react-router-dom";
import {
  pushPageViewEvent,
  PAGE_META,
  PRODUCT_DETAIL_META,
} from "../tracking/initDataLayer";

/*
  PageTracker
  ─────────────────────────────────────────────────────────────
  Renders nothing. Fires a page_view push to window.adobeDataLayer
  on every React Router route change.

  WHY THIS EXISTS AS A COMPONENT (not a hook or utility):
  React Router's useLocation() must be called inside the Router
  context. PageTracker is placed inside <Router> in App.js, which
  gives it access to location on every client-side navigation.
  It returns null so it has zero visual impact.
*/

const PageTracker = () => {
  const location        = useLocation();
  const previousPathRef = useRef(null);

  useEffect(() => {
    const currentPath  = location.pathname;
    const previousPath = previousPathRef.current;

    /* ── Resolve page metadata ─────────────────────────────── */
    let pageName     = "Unknown";
    let pageType     = "other";
    let pageCategory = "other";

    if (currentPath.startsWith("/product/")) {
      /*
        Product detail — dynamic route.
        Extract a readable name from the slug for CJA.

        Slug format: /product/{id}-{slugified-title}
        Example:     /product/1-fjallraven-kanken-backpack

        Steps:
        1. Remove the /product/ prefix
        2. Split on first "-" to separate id from title slug
        3. Replace remaining hyphens with spaces
        4. Title-case each word
      */
      const slug        = currentPath.replace("/product/", "");
      const dashIndex   = slug.indexOf("-");
      const titleSlug   = dashIndex !== -1 ? slug.slice(dashIndex + 1) : slug;
      const readableName = titleSlug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      pageName     = readableName || "Product Detail";
      pageType     = PRODUCT_DETAIL_META.pageType;      /* "product_detail" */
      pageCategory = PRODUCT_DETAIL_META.pageCategory;  /* "commerce" */

    } else if (PAGE_META[currentPath]) {
      /*
        Known static routes — read from the single source of truth
        in initDataLayer.js. No duplication of page maps.
      */
      const meta   = PAGE_META[currentPath];
      pageType     = meta.pageType;
      pageCategory = meta.pageCategory;

      /*
        Human-readable page names for CJA "Page Name" dimension.
        Derived from pageType since PAGE_META already has that info.
        Kept here so CJA sees consistent, clean names.
      */
      const PAGE_NAMES = {
        home:               "Home",
        product_list:       "Products",
        cart:               "Cart",
        checkout:           "Checkout",
        login:              "Login",
        order_confirmation: "Order Confirmation",
      };
      pageName = PAGE_NAMES[pageType] || "Unknown";

    } else {
      /*
        Unknown route — still fire a page_view so we capture
        unexpected navigations. These will show up in CJA as
        pageType "other" and alert you to missing route mappings.
      */
      pageName     = currentPath;
      pageType     = "other";
      pageCategory = "other";
    }

    /* ── Fire the ACDL push ────────────────────────────────── */
    pushPageViewEvent({
      pageName,
      pageType,
      pageCategory,
      pageUrl:         currentPath,
      previousPageUrl: previousPath,  /* null on first page load */
    });

    /* ── Update ref for next navigation ────────────────────── */
    previousPathRef.current = currentPath;

  }, [location.pathname]);
  /*
    Dependency: location.pathname only.
    We do NOT include location.search or location.hash because:
    - Search params (filters, sort) should not fire new page views
    - Hash changes are in-page anchors, not page navigations
    If you need to track search param changes as separate events,
    add a separate useEffect with a different event type.
  */

  return null;
};

export default PageTracker;