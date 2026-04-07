import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./styles.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <App />
      </ClerkProvider>
    ) : (
      <div className="config-screen">
        <div className="config-card">
          <span className="section-tag">Clerk Setup</span>
          <h1>Manjka `VITE_CLERK_PUBLISHABLE_KEY`.</h1>
          <p>
            Ustvari `.env` datoteko in dodaj svoj Clerk publishable key, nato ponovno zazeni Vite
            streznik.
          </p>
        </div>
      </div>
    )}
  </React.StrictMode>,
);
