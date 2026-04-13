import { Studio } from "sanity";
import { studioConfig } from "./studioConfig";

export default function StudioApp() {
  return <Studio config={studioConfig} />;
}
