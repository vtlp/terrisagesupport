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
      account_api_keys: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
        }
        Relationships: []
      }
      account_billing_settings: {
        Row: {
          account_id: string
          base_fee: number
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          created_at: string
          gst_pct: number
          id: string
          next_renewal_at: string | null
          plan_name: string
          seat_rate: number
          seats_purchased: number
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          account_id: string
          base_fee?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          gst_pct?: number
          id?: string
          next_renewal_at?: string | null
          plan_name?: string
          seat_rate?: number
          seats_purchased?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          base_fee?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          gst_pct?: number
          id?: string
          next_renewal_at?: string | null
          plan_name?: string
          seat_rate?: number
          seats_purchased?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_billing_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "account_seat_capacity"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "account_billing_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
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
            referencedRelation: "account_seat_capacity"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "account_checklist_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_invoices: {
        Row: {
          account_id: string
          base_fee: number
          created_at: string
          created_by: string | null
          due_at: string | null
          gst_amount: number
          gst_pct: number
          id: string
          invoice_no: string | null
          issued_at: string | null
          notes: string | null
          paid_at: string | null
          period_from: string | null
          period_to: string | null
          plan_name: string | null
          seat_count: number
          seat_rate: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          account_id: string
          base_fee?: number
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          gst_amount?: number
          gst_pct?: number
          id?: string
          invoice_no?: string | null
          issued_at?: string | null
          notes?: string | null
          paid_at?: string | null
          period_from?: string | null
          period_to?: string | null
          plan_name?: string | null
          seat_count?: number
          seat_rate?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          base_fee?: number
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          gst_amount?: number
          gst_pct?: number
          id?: string
          invoice_no?: string | null
          issued_at?: string | null
          notes?: string | null
          paid_at?: string | null
          period_from?: string | null
          period_to?: string | null
          plan_name?: string | null
          seat_count?: number
          seat_rate?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_seat_capacity"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "account_invoices_account_id_fkey"
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
            referencedRelation: "account_seat_capacity"
            referencedColumns: ["account_id"]
          },
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
            referencedRelation: "account_seat_capacity"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "account_seats_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_verifications: {
        Row: {
          account_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["verification_kind"]
          notes: string | null
          proof_storage_path: string | null
          reference_no: string | null
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["verification_kind"]
          notes?: string | null
          proof_storage_path?: string | null
          reference_no?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["verification_kind"]
          notes?: string | null
          proof_storage_path?: string | null
          reference_no?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_verifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_seat_capacity"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "account_verifications_account_id_fkey"
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
      activity_log: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          event_type: Database["public"]["Enums"]["activity_event_type"]
          id: string
          summary: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id: string
          entity_type: string
          event_type: Database["public"]["Enums"]["activity_event_type"]
          id?: string
          summary: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          event_type?: Database["public"]["Enums"]["activity_event_type"]
          id?: string
          summary?: string
        }
        Relationships: []
      }
      calendar_event_sync: {
        Row: {
          calendar_event_id: string
          created_at: string
          google_calendar_id: string | null
          google_event_id: string | null
          id: string
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          calendar_event_id: string
          created_at?: string
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          sync_error?: string | null
          sync_status?: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          calendar_event_id?: string
          created_at?: string
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          sync_error?: string | null
          sync_status?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_sync_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: true
            referencedRelation: "calendar_events"
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
      data_imports: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          error_log: string | null
          file_name: string
          id: string
          import_type: Database["public"]["Enums"]["import_type"]
          mapping_json: Json
          row_count: number | null
          size_bytes: number | null
          status: Database["public"]["Enums"]["import_status"]
          storage_path: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          error_log?: string | null
          file_name: string
          id?: string
          import_type: Database["public"]["Enums"]["import_type"]
          mapping_json?: Json
          row_count?: number | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          error_log?: string | null
          file_name?: string
          id?: string
          import_type?: Database["public"]["Enums"]["import_type"]
          mapping_json?: Json
          row_count?: number | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_seat_capacity"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "data_imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
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
          is_duplicate_of: string | null
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
          is_duplicate_of?: string | null
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
          is_duplicate_of?: string | null
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
        Relationships: [
          {
            foreignKeyName: "enquiries_is_duplicate_of_fkey"
            columns: ["is_duplicate_of"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
        ]
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
      seat_requests: {
        Row: {
          account_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          fulfilled_at: string | null
          id: string
          reason: string | null
          requested_by_email: string | null
          requested_seats: number
          status: Database["public"]["Enums"]["seat_request_status"]
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          fulfilled_at?: string | null
          id?: string
          reason?: string | null
          requested_by_email?: string | null
          requested_seats: number
          status?: Database["public"]["Enums"]["seat_request_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          fulfilled_at?: string | null
          id?: string
          reason?: string | null
          requested_by_email?: string | null
          requested_seats?: number
          status?: Database["public"]["Enums"]["seat_request_status"]
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
      account_seat_capacity: {
        Row: {
          account_id: string | null
          account_name: string | null
          plan_name: string | null
          seats_available: number | null
          seats_purchased: number | null
          seats_used: number | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
        }
        Relationships: []
      }
    }
    Functions: {
      convert_enquiry_to_account: {
        Args: { _enquiry_id: string }
        Returns: string
      }
      fulfil_seat_request: { Args: { _request_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          _details?: Json
          _entity_id: string
          _entity_type: string
          _event_type: Database["public"]["Enums"]["activity_event_type"]
          _summary: string
        }
        Returns: undefined
      }
      validate_account_api_key: { Args: { _key_hash: string }; Returns: string }
    }
    Enums: {
      account_status:
        | "LIVE"
        | "ONBOARDING_IN_PROGRESS"
        | "STALLED_ONBOARDING"
        | "DEACTIVATED"
      activity_event_type:
        | "STAGE_CHANGE"
        | "FIELD_EDIT"
        | "NOTE"
        | "CALENDAR_EVENT"
        | "SEAT_CHANGE"
        | "CHECKLIST"
        | "SUBMISSION"
        | "CONVERSION"
        | "VERIFICATION"
        | "INVOICE"
        | "IMPORT"
      app_role: "admin" | "support_agent"
      billing_cycle: "MONTHLY" | "QUARTERLY" | "ANNUAL"
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
      import_status:
        | "UPLOADED"
        | "MAPPING"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED"
      import_type: "LISTINGS" | "LEADS" | "CONTACTS" | "OTHER"
      invoice_status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED"
      seat_request_status: "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED"
      submission_status: "PENDING_REVIEW" | "APPROVED" | "REJECTED"
      subscription_status: "ACTIVE" | "PAUSED" | "CANCELLED" | "OVERDUE"
      tenancy_type: "AGENCY_BROKERAGE_CONSULTANCY" | "BUILDER_DEVELOPER"
      verification_kind: "PAN" | "GST" | "RERA" | "BANK" | "IDENTITY"
      verification_status: "PENDING" | "VERIFIED" | "REJECTED"
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
      activity_event_type: [
        "STAGE_CHANGE",
        "FIELD_EDIT",
        "NOTE",
        "CALENDAR_EVENT",
        "SEAT_CHANGE",
        "CHECKLIST",
        "SUBMISSION",
        "CONVERSION",
        "VERIFICATION",
        "INVOICE",
        "IMPORT",
      ],
      app_role: ["admin", "support_agent"],
      billing_cycle: ["MONTHLY", "QUARTERLY", "ANNUAL"],
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
      import_status: [
        "UPLOADED",
        "MAPPING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
      ],
      import_type: ["LISTINGS", "LEADS", "CONTACTS", "OTHER"],
      invoice_status: ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"],
      seat_request_status: ["PENDING", "APPROVED", "REJECTED", "FULFILLED"],
      submission_status: ["PENDING_REVIEW", "APPROVED", "REJECTED"],
      subscription_status: ["ACTIVE", "PAUSED", "CANCELLED", "OVERDUE"],
      tenancy_type: ["AGENCY_BROKERAGE_CONSULTANCY", "BUILDER_DEVELOPER"],
      verification_kind: ["PAN", "GST", "RERA", "BANK", "IDENTITY"],
      verification_status: ["PENDING", "VERIFIED", "REJECTED"],
    },
  },
} as const
