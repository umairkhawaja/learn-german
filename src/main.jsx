import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { registerSW } from "virtual:pwa-register";

// Ask the browser to keep our IndexedDB data from being evicted (honoured where supported).
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
