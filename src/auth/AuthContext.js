import React, { createContext, useContext, useEffect, useState } from "react";
import { getStoredAuth, storeAuth, clearStoredAuth } from "./authStorage";
import { clearCartStorage } from "../pages/cartPersistence";
import { store } from "../redux/store";
import { clearCart } from "../redux/cartSlice";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    email: null,
  });

  // Restore auth on app load (refresh-safe)
  useEffect(() => {
    const storedAuth = getStoredAuth();
    if (storedAuth?.isAuthenticated && storedAuth.email) {
      setAuth(storedAuth);

      // Sync AEP user context on refresh if already logged in
      if (window.dataLayer) {
        window.dataLayer.user = {
          isLoggedIn: true,
          loginState: "authenticated",
          authId: storedAuth.email,
          authNamespace: "email",
        };
      }
    }
  }, []);

  const login = (email) => {
    if (auth.isAuthenticated) {
      throw new Error("Another user is already logged in. Please logout first.");
    }

    const authData = {
      isAuthenticated: true,
      email,
      loginTimestamp: Date.now(),
    };

    setAuth(authData);
    storeAuth(authData);
    // Note: dataLayer.user is set in Login.js AFTER login() succeeds,
    // so the event fires correctly with navigate() in sequence.
  };

  const logout = () => {
    // ── STEP 1: Clear Redux cart state immediately (UI updates)
    store.dispatch(clearCart());

    // ── STEP 2: Wipe cart from localStorage (prevents leaking to next user)
    clearCartStorage();

    // ── STEP 3: Clear auth state + localStorage
    setAuth({ isAuthenticated: false, email: null });
    clearStoredAuth();

    // ── STEP 4: Reset AEP data layer — user + cart contexts
    if (window.dataLayer) {
      window.dataLayer.user = {
        isLoggedIn: false,
        loginState: "guest",
        authId: null,
        authNamespace: null,
      };

      // Wipe cart from dataLayer so no stale data fires after logout
      window.dataLayer.cart = {
        items: [],
        totalQuantity: 0,
        totalValue: 0,
        currency: "USD",
      };

      window.dataLayer.event = {
        name: "logout",
        category: "identity",
        timestamp: Date.now(),
      };

      console.log("🔓 logout event fired — cart cleared:", window.dataLayer);

      if (window._satellite?.track) {
        window._satellite.track("aep_logout");
      }
    }
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};