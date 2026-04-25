import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import { Provider } from "react-redux";
import { store } from "./redux/store";
import App from "./App";
import "./App.css";
import { AuthProvider } from "./auth/AuthContext";
import { initDataLayer } from "./tracking/initDataLayer";

// Initialize the AEP data layer BEFORE anything renders
initDataLayer();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Provider>
  </React.StrictMode>
);

reportWebVitals();