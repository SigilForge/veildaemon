export type RoutingMode = "path" | "subdomain";
export type PlanId = "free" | "pro" | "business";

export type Profile = {
  id: string;
  email: string;
  plan: PlanId;
  role: "user" | "admin";
  billing_status: string;
  suspended_at: string | null;
};

export type QrArtOption = "none" | "emblem" | "seal" | "mark" | "book-one" | "studio-seal" | "custom";
export type QrFrameStyleOption = "badge" | "poster" | "tech-card" | "neon";

export type RedirectRecord = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  routing_mode: RoutingMode;
  destination_url: string;
  active: boolean;
  expires_at: string | null;
  notes: string;
  qr_foreground: string;
  qr_background: string;
  qr_ecc: "L" | "M" | "Q" | "H";
  qr_art: QrArtOption;
  qr_custom_art_url: string;
  qr_accent: string;
  qr_accent_rate: number;
  qr_eye_color: string;
  qr_frame_style: QrFrameStyleOption;
  qr_frame_title: string;
  qr_frame_subtitle: string;
  qr_node: string;
  qr_clearance: string;
  qr_footer: string;
  total_scans: number;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type RedirectInput = {
  name: string;
  slug: string;
  routingMode: RoutingMode;
  destinationUrl: string;
  active: boolean;
  expiresAt?: string;
  notes?: string;
  qrForeground?: string;
  qrBackground?: string;
  qrEcc?: "L" | "M" | "Q" | "H";
  qrArt?: QrArtOption;
  qrCustomArtUrl?: string;
  qrAccent?: string;
  qrAccentRate?: number;
  qrEyeColor?: string;
  qrFrameStyle?: QrFrameStyleOption;
  qrFrameTitle?: string;
  qrFrameSubtitle?: string;
  qrNode?: string;
  qrClearance?: string;
  qrFooter?: string;
};
