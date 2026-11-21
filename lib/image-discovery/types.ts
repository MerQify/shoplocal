import type { HubLicence, HubSource } from "@/lib/image-hub/client";

export type DiscoveryProvider = "OPENVERSE" | "WIKIMEDIA" | "OPEN_FOOD_FACTS";

export type DiscoveryLicence = Extract<HubLicence, "CC0" | "PDM" | "CC_BY" | "CC_BY_SA">;

export interface DiscoveredImage {
  id: string;
  provider: DiscoveryProvider;
  title: string;
  thumbnailUrl: string;
  originalUrl: string;
  downloadUrl?: string;
  sourceSite: string;
  licence: DiscoveryLicence;
  attribution: string;
  width?: number;
  height?: number;
}

export interface DiscoveryImportSelection {
  id: string;
  provider: DiscoveryProvider;
  query: string;
}

export interface DiscoverySearchParams {
  query: string;
  provider?: DiscoveryProvider | "ALL";
  limit?: number;
}

export interface DiscoverySearchResult {
  items: DiscoveredImage[];
  errors?: Record<string, string>;
}
