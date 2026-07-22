export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          plan: "free" | "pro" | "business";
          role: "user" | "admin";
          billing_provider: string | null;
          billing_customer_id: string | null;
          billing_subscription_id: string | null;
          billing_status: string;
          suspended_at: string | null;
          suspension_reason: string | null;
          terms_accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string; email: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      redirects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          slug: string;
          routing_mode: "path" | "subdomain";
          destination_url: string;
          active: boolean;
          expires_at: string | null;
          notes: string;
          qr_foreground: string;
          qr_background: string;
          qr_ecc: "L" | "M" | "Q" | "H";
          total_scans: number;
          suspended_at: string | null;
          suspension_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["redirects"]["Row"]> & {
          user_id: string;
          name: string;
          slug: string;
          routing_mode: "path" | "subdomain";
          destination_url: string;
        };
        Update: Partial<Database["public"]["Tables"]["redirects"]["Row"]>;
        Relationships: [];
      };
      scan_events: {
        Row: {
          id: string;
          redirect_id: string;
          scanned_at: string;
          referrer: string | null;
          user_agent: string | null;
          device_category: string | null;
          browser_family: string | null;
          operating_system: string | null;
          country: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["scan_events"]["Row"]> & { redirect_id: string };
        Update: Partial<Database["public"]["Tables"]["scan_events"]["Row"]>;
        Relationships: [];
      };
      abuse_reports: {
        Row: {
          id: string;
          redirect_id: string | null;
          reporter_email: string | null;
          reason: string;
          details: string;
          status: "open" | "reviewing" | "closed";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["abuse_reports"]["Row"]> & { reason: string };
        Update: Partial<Database["public"]["Tables"]["abuse_reports"]["Row"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]> & {
          action: string;
          entity_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_redirect_scans: {
        Args: { redirect_id_input: string };
        Returns: void;
      };
    };
    Enums: {
      veillink_plan: "free" | "pro" | "business";
      veillink_role: "user" | "admin";
      veillink_routing_mode: "path" | "subdomain";
      veillink_abuse_status: "open" | "reviewing" | "closed";
    };
    CompositeTypes: Record<string, never>;
  };
};
