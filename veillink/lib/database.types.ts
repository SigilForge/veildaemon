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
          qr_art: "none" | "emblem" | "seal" | "mark" | "book-one" | "studio-seal" | "custom";
          qr_custom_art_url: string;
          qr_accent: string;
          qr_accent_rate: number;
          qr_eye_color: string;
          qr_frame_style: "badge" | "poster" | "tech-card" | "neon";
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
      stripe_webhook_events: {
        Row: {
          id: string;
          type: string;
          livemode: boolean;
          received_at: string;
          processed_at: string | null;
          last_error: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["stripe_webhook_events"]["Row"]> & {
          id: string;
          type: string;
        };
        Update: Partial<Database["public"]["Tables"]["stripe_webhook_events"]["Row"]>;
        Relationships: [];
      };
      operator_profiles: {
        Row: {
          id: string;
          owner_user_id: string;
          display_name: string;
          designation: string;
          persistent_state: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["operator_profiles"]["Row"]> & {
          owner_user_id: string;
          display_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["operator_profiles"]["Row"]>;
        Relationships: [];
      };
      handler_sessions: {
        Row: {
          id: string;
          handler_user_id: string;
          join_code: string;
          status: "open" | "closed";
          needlepoint: string;
          mission: string;
          max_operators: number | null;
          created_at: string;
          closed_at: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["handler_sessions"]["Row"]> & {
          handler_user_id: string;
          join_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["handler_sessions"]["Row"]>;
        Relationships: [];
      };
      session_operator_state: {
        Row: {
          id: string;
          session_id: string;
          operator_profile_id: string;
          owner_user_id: string;
          live_state: Json;
          joined_at: string;
          left_at: string | null;
          last_mutated_by: string | null;
          last_mutated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["session_operator_state"]["Row"]> & {
          session_id: string;
          operator_profile_id: string;
          owner_user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["session_operator_state"]["Row"]>;
        Relationships: [];
      };
      session_mutations: {
        Row: {
          id: string;
          session_id: string;
          session_operator_state_id: string;
          actor_user_id: string | null;
          actor_role: "handler" | "operator";
          field_path: string;
          old_value: Json | null;
          new_value: Json | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["session_mutations"]["Row"]> & {
          session_id: string;
          session_operator_state_id: string;
          actor_role: "handler" | "operator";
          field_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["session_mutations"]["Row"]>;
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
      table_session_status: "open" | "closed";
      table_actor_role: "handler" | "operator";
    };
    CompositeTypes: Record<string, never>;
  };
};
