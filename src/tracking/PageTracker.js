import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const PAGE_MAP = {
  "/": { name: "Home", type: "home" },
  "/products": { name: "Products", type: "product_list" },
  "/cart": { name: "Cart", type: "cart" },
  "/checkout": { name: "Checkout", type: "checkout" },
  "/login": { name: "Login", type: "login" },
  "/confirmation": { name: "Order Confirmation", type: "order_confirmation" },
};

const PageTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (!window.dataLayer) return;

    let pageName = "Unknown";
    let pageType = "other";

    // Dynamic product detail route
    if (location.pathname.startsWith("/product/")) {
      pageName = "Product Detail";
      pageType = "product_detail";
    } else if (PAGE_MAP[location.pathname]) {
      pageName = PAGE_MAP[location.pathname].name;
      pageType = PAGE_MAP[location.pathname].type;
    }

    const previousPage = window.dataLayer.page?.url || null;

    // Update page context
    window.dataLayer.page = {
      ...window.dataLayer.page,
      name: pageName,
      type: pageType,
      url: location.pathname,
      previousPage,
      referrerType: previousPage ? "internal" : "direct",
    };

    // Fire page_view event
    window.dataLayer.event = {
      name: "page_view",
      category: "navigation",
      timestamp: Date.now(),
    };

    console.log("📘 page_view fired:", window.dataLayer.page);

    // Trigger Adobe Launch rule
    if (window._satellite && typeof window._satellite.track === "function") {
      window._satellite.track("aep_page_view");
    }
  }, [location.pathname]);

  return null;
};

export default PageTracker;