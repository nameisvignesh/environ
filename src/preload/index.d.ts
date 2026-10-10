import type { EnvironApi } from "../shared/api";

declare global {
  interface Window {
    environ: EnvironApi;
  }
}
