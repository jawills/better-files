import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./demo.css";

const container = document.getElementById("root");
if (!container) throw new Error("Demo root is missing.");
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
