import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { initAnalytics } from "./lib/firebase";
import { getStoredConsent } from "./components/CookieBanner";
import "./styles.css";

if (getStoredConsent() === "all") {
  void initAnalytics();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
