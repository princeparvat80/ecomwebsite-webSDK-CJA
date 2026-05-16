import React, { createContext, useContext, useEffect, useState } from "react";
import { getStoredAuth, storeAuth, clearStoredAuth } from "./authStorage";
import { clearCartStorage }                           from "../pages/cartPersistence";
import { store }                                      from "../redux/store";
import { clearCart }                                  from "../redux/cartSlice";
import { pushLogoutEvent }                            from "../tracking/initDataLayer";

/*
  AuthContext
  ─────────────────────────────────────────────────────────────
  Provides auth state (isAuthenticated, email) and two actions
  (login, logout) to the entire React tree via Context.

*/

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    email:           null,
  });

  /*
    Restore auth state on app load / page refresh.

    On refresh, React state is lost but localStorage is not.
    We read ECOM_AUTH_USER from localStorage and restore the
    auth state into React so the UI (Navbar, Checkout guard)
    correctly reflects the logged-in user.

    We do NOT push any ACDL event here.
    WHY: This is not a login event — the user did not actively
    log in. They refreshed the page. Firing a login event here
    would pollute CJA session analysis with false login counts
    and could trigger AJO login-entry journeys incorrectly.

    Identity is still correctly set on every subsequent push
    because getCurrentIdentityMap() in initDataLayer.js reads
    from localStorage directly on every push call.
  */
  useEffect(() => {
    const storedAuth = getStoredAuth();
    if (storedAuth?.isAuthenticated && storedAuth.email) {
      setAuth(storedAuth);
    }
  }, []);

  /*
    login(email)
    ─────────────────────────────────────────────────────────
    Stores auth state in React and localStorage.
    Does NOT fire any ACDL push — that is Login.js's job.

    WHY the tracking push is NOT here:
    The push must happen in Login.js because that is where we
    have the navigate() call. The correct event sequence is:

      login(email)           ← AuthContext: stores auth state
      pushLoginEvent(email)  ← Login.js: ACDL push with identityMap
      navigate(from)         ← Login.js: React Router navigation
      pushPageViewEvent()    ← PageTracker: fires for the new page

    If pushLoginEvent were called here, it would fire before
    storeAuth() completes writing to localStorage in some
    async edge cases, causing getCurrentIdentityMap() to read
    stale state in the push.
  */
  const login = (email) => {
    if (auth.isAuthenticated) {
      throw new Error(
        "Another user is already logged in. Please log out first."
      );
    }

    const authData = {
      isAuthenticated: true,
      email,
      loginTimestamp:  new Date().toISOString(), /* ISO 8601 — consistent with tracking */
    };

    setAuth(authData);
    storeAuth(authData); /* Writes to localStorage before Login.js calls pushLoginEvent */
  };

  /*
    logout()
    ─────────────────────────────────────────────────────────
    Operation order is critical. Here is why each step is in
    this exact sequence:

    STEP 1 — pushLogoutEvent() FIRST
    Must fire before we clear localStorage. pushLogoutEvent()
    calls buildUserContext() and buildSessionContext() internally,
    both of which read from localStorage. If we clear storage
    first, the logout push carries null user context and becomes
    useless for CJA "who logged out" analysis and AJO suppression
    rules like "do not send re-engagement to users who logged out".

    STEP 2 — dispatch(clearCart()) 
    Clears Redux cart state immediately. This causes the Navbar
    cart count badge to drop to 0 and the Cart page to show
    "empty" — immediate UI feedback for the user.

    STEP 3 — clearCartStorage()
    Wipes the cart from localStorage. Prevents the next user
    on this browser from inheriting the previous user's cart
    if they visit without the tab being closed (cart is loaded
    from localStorage into Redux on store initialization).

    STEP 4 — clearStoredAuth() + setAuth()
    Clears auth from localStorage and React state.
    Done AFTER the push (Step 1) so the push reads correct data.
    setAuth() triggers a React re-render: Navbar switches from
    showing the user email to showing the "Sign In" button.
  */
  const logout = () => {
    /* STEP 1: Push logout event BEFORE clearing any state */
    pushLogoutEvent();

    /* STEP 2: Clear Redux cart (immediate UI update) */
    store.dispatch(clearCart());

    /* STEP 3: Wipe cart from localStorage (prevents session leak) */
    clearCartStorage();

    /* STEP 4: Clear auth from localStorage and React state */
    clearStoredAuth();
    setAuth({ isAuthenticated: false, email: null });
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

/*
  useAuth()
  ─────────────────────────────────────────────────────────────
  Custom hook for consuming auth context.
  The guard ensures a clear error message if a component tries
  to use auth outside of the AuthProvider tree.
*/
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};