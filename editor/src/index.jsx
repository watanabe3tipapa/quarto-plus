import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

const mount = document.getElementById("qp-editor-root");
if (mount) {
  createRoot(mount).render(<App />);
}
