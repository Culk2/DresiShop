import { defineConfig } from "sanity";
import { deskTool } from "sanity/desk";
import { schemaTypes } from "../sanity/schemaTypes/dresiShopSchema";

export const studioConfig = defineConfig({
  name: "dresi-shop-studio",
  title: "Dresi Shop Studio",
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID,
  dataset: import.meta.env.VITE_SANITY_DATASET || "production",
  basePath: "/studio",
  plugins: [deskTool()],
  schema: {
    types: schemaTypes,
  },
});
