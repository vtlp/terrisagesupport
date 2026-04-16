export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_checklist_items: {
        Row: {
          account_id: string
          created_at: string
          done_at: string | null
          done_by: string | null
          id: string
          is_done: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_checklist_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_notes: {
        Row: {
          account_id: string
          author_id: string | null
          created_at: string
          id: string
          note_text: string
        }
        Insert: {
          account_id: string
          author_id?: string | null
          created_at?: string
          id?: string
          note_text: string
        }
        Update: {
          account_id?: string
          author_id?: string | null
          created_at?: string
          id?: string
          note_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_seats: {
        Row: {
          account_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_seats_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_code: string | null
          account_name: string
          city: string | null
          created_at: string
          gst_number: string | null
          id: string
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          pan_number: string | null
          payload: Json
          rera_number: string | null
          source_enquiry_id: string | null
          source_submission_id: string | null
          status: Database["public"]["Enums"]["account_status"]
          tenancy_type: Database["public"]["Enums"]["tenancy_type"]
          updated_at: string
          website: string | null
        }
        Insert: {
          account_code?: string | null
          account_name: string
          city?: string | null
          created_at?: string
          gst_number?: string | null
          id?: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          pan_number?: string | null
          payload?: Json
          rera_number?: string | null
          source_enquiry_id?: string | null
          source_submission_id?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tenancy_type: Database["public"]["Enums"]["tenancy_type"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_code?: string | null
          account_name?: string
          city?: string | null
          created_at?: string
          gst_number?: string | null
          id?: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          pan_number?: string | null
          payload?: Json
          rera_number?: string | null
          source_enquiry_id?: string | null
          source_submission_id?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tenancy_type?: Database["public"]["Enums"]["tenancy_type"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_source_enquiry_id_fkey"
            columns: ["source_enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "onboarding_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          duration_min: number
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          id: string
          notes: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["calendar_event_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          notes?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["calendar_event_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          notes?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["calendar_event_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      enquiries: {
        Row: {
          assigned_to: string | null
          city: string | null
          company_name: string | null
          converted_account_id: string | null
          created_at: string
          demo_completed_at: string | null
          demo_scheduled_at: string | null
          email: string | null
          enquiry_code: string | null
          full_name: string
          id: string
          lost_reason: string | null
          onboarding_form_link: string | null
          onboarding_pack_sent: boolean
          onboarding_pack_sent_at: string | null
          payload: Json
          phone: string
          source: string | null
          stage: Database["public"]["Enums"]["enquiry_stage"]
          tenancy_type: Database["public"]["Enums"]["tenancy_type"] | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          city?: string | null
          company_name?: string | null
          converted_account_id?: string | null
          created_at?: string
          demo_completed_at?: string | null
          demo_scheduled_at?: string | null
          email?: string | null
          enquiry_code?: string | null
          full_name: string
          id?: string
          lost_reason?: string | null
          onboarding_form_link?: string | null
          onboarding_pack_sent?: boolean
          onboarding_pack_sent_at?: string | null
          payload?: Json
          phone: string
          source?: string | null
          stage?: Database["public"]["Enums"]["enquiry_stage"]
          tenancy_type?: Database["public"]["Enums"]["tenancy_type"] | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          city?: string | null
          company_name?: string | null
          converted_account_id?: string | null
          created_at?: string
          demo_completed_at?: string | null
          demo_scheduled_at?: string | null
          email?: string | null
          enquiry_code?: string | null
          full_name?: string
          id?: string
          lost_reason?: string | null
          onboarding_form_link?: string | null
          onboarding_pack_sent?: boolean
          onboarding_pack_sent_at?: string | null
          payload?: Json
          phone?: string
          source?: string | null
          stage?: Database["public"]["Enums"]["enquiry_stage"]
          tenancy_type?: Database["public"]["Enums"]["tenancy_type"] | null
          updated_at?: string
        }
        Relationships: []
      }
      enquiry_notes: {
        Row: {
          author_id: string | null
          created_at: string
          enquiry_id: string
          id: string
          note_text: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          enquiry_id: string
          id?: string
          note_text: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          enquiry_id?: string
          id?: string
          note_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiry_notes_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          body: string
          bucket_key: string
          created_at: string
          created_by: string | null
          id: string
          tags: string[] | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body?: string
          bucket_key: string
          created_at?: string
          created_by?: string | null
          id?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          body?: string
          bucket_key?: string
          created_at?: string
          created_by?: string | null
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      kb_files: {
        Row: {
          created_at: string
          folder_id: string | null
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "kb_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_folders: {
        Row: {
          bucket_key: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          bucket_key?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          bucket_key?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "kb_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_submissions: {
        Row: {
          created_at: string
          enquiry_id: string | null
          id: string
          payload: Json
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string
          tenancy_type: Database["public"]["Enums"]["tenancy_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          enquiry_id?: string | null
          id?: string
          payload?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          tenancy_type: Database["public"]["Enums"]["tenancy_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          enquiry_id?: string | null
          id?: string
          payload?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          tenancy_type?: Database["public"]["Enums"]["tenancy_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_submissions_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      convert_enquiry_to_account: {
        Args: { _enquiry_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      account_status:
        | "LIVE"
        | "ONBOARDING_IN_PROGRESS"
        | "STALLED_ONBOARDING"
        | "DEACTIVATED"
      app_role: "admin" | "support_agent"
      calendar_event_status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
      calendar_event_type:
        | "DEMO"
        | "FOLLOW_UP"
        | "CALL_BACK"
        | "CHECK_IN"
        | "ONBOARDING"
        | "OTHER"
      enquiry_stage:
        | "NEW_ENQUIRY"
        | "CONTACTED"
        | "DEMO_SCHEDULED"
        | "DEMO_COMPLETED"
        | "ONBOARDING_PACK_SENT"
        | "ACCOUNT_CREATED"
        | "LOST"
      submission_status: "PENDING_REVIEW" | "APPROVED" | "REJECTED"
      tenancy_type: "AGENCY_BROKERAGE_CONSULTANCY" | "BUILDER_DEVELOPER"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: [
        "LIVE",
        "ONBOARDING_IN_PROGRESS",
        "STALLED_ONBOARDING",
        "DEACTIVATED",
      ],
      app_role: ["admin", "support_agent"],
      calendar_event_status: ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"],
      calendar_event_type: [
        "DEMO",
        "FOLLOW_UP",
        "CALL_BACK",
        "CHECK_IN",
        "ONBOARDING",
        "OTHER",
      ],
      enquiry_stage: [
        "NEW_ENQUIRY",
        "CONTACTED",
        "DEMO_SCHEDULED",
        "DEMO_COMPLETED",
        "ONBOARDING_PACK_SENT",
        "ACCOUNT_CREATED",
        "LOST",
      ],
      submission_status: ["PENDING_REVIEW", "APPROVED", "REJECTED"],
      tenancy_type: ["AGENCY_BROKERAGE_CONSULTANCY", "BUILDER_DEVELOPER"],
    },
  },
} as const
