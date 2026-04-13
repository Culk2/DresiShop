import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./styles.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isStudioRoute = window.location.pathname.startsWith("/studio");
const StudioApp = lazy(() => import("./StudioApp"));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isStudioRoute ? (
      <Suspense fallback={<div className="config-screen"><div className="config-card"><span className="eyebrow">Studio</span><h1>Nalagam Studio ...</h1></div></div>}>
        <StudioApp />
      </Suspense>
    ) : clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <App />
      </ClerkProvider>
    ) : (
      <div className="config-screen">
        <div className="config-card">
          <span className="eyebrow">Clerk Setup</span>
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
