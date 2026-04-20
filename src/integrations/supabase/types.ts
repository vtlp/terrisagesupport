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
          {
            foreignKeyName: "account_billing_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "v_account_usage"
            referencedColumns: ["account_id"]
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
          {
            foreignKeyName: "account_checklist_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_usage"
            referencedColumns: ["account_id"]
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
          {
            foreignKeyName: "account_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_usage"
            referencedColumns: ["account_id"]
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
          {
            foreignKeyName: "account_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_usage"
            referencedColumns: ["account_id"]
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
          {
            foreignKeyName: "account_seats_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_usage"
            referencedColumns: ["account_id"]
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
          {
            foreignKeyName: "account_verifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_usage"
            referencedColumns: ["account_id"]
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
      content_calendar: {
        Row: {
          asset_path: string | null
          body_text: string | null
          campaign_id: string | null
          channel_id: string | null
          created_at: string
          created_by: string | null
          format: string | null
          id: string
          notes: string | null
          owner_id: string | null
          published_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          asset_path?: string | null
          body_text?: string | null
          campaign_id?: string | null
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          format?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          asset_path?: string | null
          body_text?: string | null
          campaign_id?: string | null
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          format?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_calendar_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_calendar_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_marketing_performance"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "content_calendar_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "data_imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_usage"
            referencedColumns: ["account_id"]
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
      integration_settings: {
        Row: {
          connected_at: string | null
          created_at: string
          google_account_email: string | null
          google_calendar_id: string | null
          google_client_id: string | null
          google_client_secret: string | null
          google_refresh_token: string | null
          id: string
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          google_account_email?: string | null
          google_calendar_id?: string | null
          google_client_id?: string | null
          google_client_secret?: string | null
          google_refresh_token?: string | null
          id?: string
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          google_account_email?: string | null
          google_calendar_id?: string | null
          google_client_id?: string | null
          google_client_secret?: string | null
          google_refresh_token?: string | null
          id?: string
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      lead_sources: {
        Row: {
          channel_id: string | null
          created_at: string
          id: string
          is_active: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      lookup_cities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          state: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          state?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          state?: string | null
        }
        Relationships: []
      }
      lookup_enquiry_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      lookup_portals: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          name: string
          prerequisites: Json
          sort_order: number
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          name: string
          prerequisites?: Json
          sort_order?: number
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          prerequisites?: Json
          sort_order?: number
          website?: string | null
        }
        Relationships: []
      }
      lookup_tags: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          budget: number
          channel_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          objective: string | null
          owner_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
        }
        Insert: {
          budget?: number
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          objective?: string | null
          owner_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Update: {
          budget?: number
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          objective?: string | null
          owner_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_channels: {
        Row: {
          channel_type: Database["public"]["Enums"]["marketing_channel_type"]
          created_at: string
          default_cost_type:
            | Database["public"]["Enums"]["marketing_cost_type"]
            | null
          id: string
          is_active: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          channel_type?: Database["public"]["Enums"]["marketing_channel_type"]
          created_at?: string
          default_cost_type?:
            | Database["public"]["Enums"]["marketing_cost_type"]
            | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          channel_type?: Database["public"]["Enums"]["marketing_channel_type"]
          created_at?: string
          default_cost_type?:
            | Database["public"]["Enums"]["marketing_cost_type"]
            | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketing_contacts: {
        Row: {
          attachments: Json
          city: string | null
          company: string | null
          contact_type: Database["public"]["Enums"]["contact_type"]
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json
          city?: string | null
          company?: string | null
          contact_type?: Database["public"]["Enums"]["contact_type"]
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json
          city?: string | null
          company?: string | null
          contact_type?: Database["public"]["Enums"]["contact_type"]
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_cost_items: {
        Row: {
          amount: number
          city: string | null
          cost_type: Database["public"]["Enums"]["marketing_cost_item_type"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          notes: string | null
          spend_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          city?: string | null
          cost_type: Database["public"]["Enums"]["marketing_cost_item_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          spend_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          city?: string | null
          cost_type?: Database["public"]["Enums"]["marketing_cost_item_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          spend_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_costs: {
        Row: {
          amount: number
          campaign_id: string
          clicks: number | null
          cost_type: Database["public"]["Enums"]["marketing_cost_type"]
          created_at: string
          created_by: string | null
          currency: string
          id: string
          impressions: number | null
          leads: number | null
          notes: string | null
          period_from: string | null
          period_to: string | null
        }
        Insert: {
          amount: number
          campaign_id: string
          clicks?: number | null
          cost_type: Database["public"]["Enums"]["marketing_cost_type"]
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          impressions?: number | null
          leads?: number | null
          notes?: string | null
          period_from?: string | null
          period_to?: string | null
        }
        Update: {
          amount?: number
          campaign_id?: string
          clicks?: number | null
          cost_type?: Database["public"]["Enums"]["marketing_cost_type"]
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          impressions?: number | null
          leads?: number | null
          notes?: string | null
          period_from?: string | null
          period_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_costs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_costs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_marketing_performance"
            referencedColumns: ["campaign_id"]
          },
        ]
      }
      marketing_events: {
        Row: {
          attendees: number
          city: string | null
          created_at: string
          created_by: string | null
          event_date: string | null
          event_name: string
          id: string
          location: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          attendees?: number
          city?: string | null
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          event_name: string
          id?: string
          location?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          attendees?: number
          city?: string | null
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          event_name?: string
          id?: string
          location?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_governance: {
        Row: {
          approver_id: string | null
          created_at: string
          decided_at: string | null
          decision: Database["public"]["Enums"]["governance_decision"]
          decision_notes: string | null
          entity_id: string
          entity_type: string
          id: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["governance_decision"]
          decision_notes?: string | null
          entity_id: string
          entity_type: string
          id?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["governance_decision"]
          decision_notes?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_referral_records: {
        Row: {
          commission_pct: number
          contact_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          price_per_seat: number
          referral_date: string
          seats_referred: number
          status: Database["public"]["Enums"]["referral_status"]
          updated_at: string
        }
        Insert: {
          commission_pct?: number
          contact_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          price_per_seat?: number
          referral_date?: string
          seats_referred?: number
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Update: {
          commission_pct?: number
          contact_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          price_per_seat?: number
          referral_date?: string
          seats_referred?: number
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_referral_records_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "marketing_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_settings: {
        Row: {
          created_at: string
          id: string
          total_spend_override: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          total_spend_override?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          total_spend_override?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      marketing_targets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          q1: number
          q2: number
          q3: number
          q4: number
          tenancy_type: Database["public"]["Enums"]["tenancy_type"]
          total_target: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          q1?: number
          q2?: number
          q3?: number
          q4?: number
          tenancy_type: Database["public"]["Enums"]["tenancy_type"]
          total_target?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          q1?: number
          q2?: number
          q3?: number
          q4?: number
          tenancy_type?: Database["public"]["Enums"]["tenancy_type"]
          total_target?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
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
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          message_id: string | null
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          message_id?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          message_id?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_queue_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          queue_id: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          queue_id: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          queue_id?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_queue_members_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "ticket_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_queues: {
        Row: {
          created_at: string
          default_assignee: string | null
          description: string | null
          id: string
          is_active: boolean
          key: string
          last_assigned_at: string | null
          last_assigned_user_id: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_assignee?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          last_assigned_at?: string | null
          last_assigned_user_id?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_assignee?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          last_assigned_at?: string | null
          last_assigned_user_id?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          account_id: string | null
          assigned_to: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          closed_at: string | null
          created_at: string
          created_by: string | null
          csat_comment: string | null
          csat_rating: number | null
          description: string
          first_response_at: string | null
          id: string
          market_city: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          queue_id: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          requester_email: string | null
          requester_name: string
          requester_phone: string | null
          resolution_code: string | null
          resolution_notes: string | null
          resolved_at: string | null
          sla_first_response_at: string | null
          sla_resolution_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tags: string[]
          ticket_code: string | null
          type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          csat_comment?: string | null
          csat_rating?: number | null
          description?: string
          first_response_at?: string | null
          id?: string
          market_city?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          queue_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          requester_email?: string | null
          requester_name: string
          requester_phone?: string | null
          resolution_code?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          sla_first_response_at?: string | null
          sla_resolution_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tags?: string[]
          ticket_code?: string | null
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          csat_comment?: string | null
          csat_rating?: number | null
          description?: string
          first_response_at?: string | null
          id?: string
          market_city?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          queue_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          requester_email?: string | null
          requester_name?: string
          requester_phone?: string | null
          resolution_code?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          sla_first_response_at?: string | null
          sla_resolution_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          tags?: string[]
          ticket_code?: string | null
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_seat_capacity"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "tickets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_usage"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "tickets_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "ticket_queues"
            referencedColumns: ["id"]
          },
        ]
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
      utm_links: {
        Row: {
          campaign_id: string | null
          click_count: number
          created_at: string
          created_by: string | null
          destination: string
          full_url: string
          id: string
          short_code: string | null
          utm_campaign: string
          utm_content: string | null
          utm_medium: string
          utm_source: string
          utm_term: string | null
        }
        Insert: {
          campaign_id?: string | null
          click_count?: number
          created_at?: string
          created_by?: string | null
          destination: string
          full_url: string
          id?: string
          short_code?: string | null
          utm_campaign: string
          utm_content?: string | null
          utm_medium: string
          utm_source: string
          utm_term?: string | null
        }
        Update: {
          campaign_id?: string | null
          click_count?: number
          created_at?: string
          created_by?: string | null
          destination?: string
          full_url?: string
          id?: string
          short_code?: string | null
          utm_campaign?: string
          utm_content?: string | null
          utm_medium?: string
          utm_source?: string
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "utm_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utm_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_marketing_performance"
            referencedColumns: ["campaign_id"]
          },
        ]
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
      v_account_usage: {
        Row: {
          account_created_at: string | null
          account_id: string | null
          account_name: string | null
          account_status: string | null
          city: string | null
          last_activity_at: string | null
          plan_name: string | null
          seats_purchased: number | null
          seats_used: number | null
          tenancy_type: string | null
        }
        Relationships: []
      }
      v_marketing_performance: {
        Row: {
          budget: number | null
          campaign_id: string | null
          campaign_name: string | null
          channel_name: string | null
          clicks: number | null
          cost_per_lead: number | null
          impressions: number | null
          leads: number | null
          spend: number | null
          status: string | null
        }
        Relationships: []
      }
      v_pipeline_funnel: {
        Row: {
          enquiry_count: number | null
          last_30d: number | null
          last_7d: number | null
          stage: string | null
        }
        Relationships: []
      }
      v_ticket_sla_compliance: {
        Row: {
          awaiting_first_response: number | null
          first_response_met: number | null
          priority: string | null
          resolution_met: number | null
          status: string | null
          ticket_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_submission_lock: { Args: { _enquiry_id: string }; Returns: string }
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
      mark_stalled_accounts: { Args: never; Returns: number }
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
        | "TICKET"
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
      campaign_status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED"
      contact_type:
        | "Adviser/Mentor"
        | "Champion (non user)"
        | "CRM CP"
        | "Investor"
        | "Media/PR"
        | "Potential Hire"
        | "Prospect Customer"
        | "Strategic Partner"
        | "Vendor/Service Provider"
        | "VIP"
      content_status: "IDEA" | "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED"
      enquiry_stage:
        | "NEW_ENQUIRY"
        | "CONTACTED"
        | "DEMO_SCHEDULED"
        | "DEMO_COMPLETED"
        | "PAYMENT_LINK_SENT"
        | "ONBOARDING_PACK_SENT"
        | "ACCOUNT_CREATED"
        | "LOST"
      governance_decision:
        | "PENDING"
        | "APPROVED"
        | "CHANGES_REQUESTED"
        | "REJECTED"
      import_status:
        | "UPLOADED"
        | "MAPPING"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED"
      import_type: "LISTINGS" | "LEADS" | "CONTACTS" | "OTHER"
      invoice_status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED"
      marketing_channel_type:
        | "PAID"
        | "ORGANIC"
        | "REFERRAL"
        | "DIRECT"
        | "EVENT"
        | "OTHER"
      marketing_cost_item_type: "ONLINE" | "OFFLINE"
      marketing_cost_type: "CPM" | "CPC" | "CPL" | "FIXED" | "RETAINER"
      referral_status:
        | "Closed"
        | "In Process"
        | "New"
        | "Paid"
        | "Pending"
        | "Referred"
        | "Rejected"
      seat_request_status: "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED"
      submission_status: "PENDING_REVIEW" | "APPROVED" | "REJECTED"
      subscription_status: "ACTIVE" | "PAUSED" | "CANCELLED" | "OVERDUE"
      tenancy_type: "AGENCY_BROKERAGE_CONSULTANCY" | "BUILDER_DEVELOPER"
      ticket_category:
        | "LISTINGS_INVENTORY"
        | "BILLING_PLAN"
        | "API_INTEGRATIONS"
        | "ONBOARDING_MIGRATION"
        | "SECURITY_ACCESS"
        | "COMPLIANCE_LEGAL"
        | "PERFORMANCE_RELIABILITY"
        | "OTHER"
      ticket_priority: "P1" | "P2" | "P3" | "P4"
      ticket_status:
        | "OPEN"
        | "PENDING_CUSTOMER"
        | "PENDING_INTERNAL"
        | "RESOLVED"
        | "CLOSED"
      ticket_type: "INCIDENT" | "QUESTION" | "TASK" | "FEEDBACK"
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
        "TICKET",
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
      campaign_status: ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"],
      contact_type: [
        "Adviser/Mentor",
        "Champion (non user)",
        "CRM CP",
        "Investor",
        "Media/PR",
        "Potential Hire",
        "Prospect Customer",
        "Strategic Partner",
        "Vendor/Service Provider",
        "VIP",
      ],
      content_status: ["IDEA", "DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"],
      enquiry_stage: [
        "NEW_ENQUIRY",
        "CONTACTED",
        "DEMO_SCHEDULED",
        "DEMO_COMPLETED",
        "PAYMENT_LINK_SENT",
        "ONBOARDING_PACK_SENT",
        "ACCOUNT_CREATED",
        "LOST",
      ],
      governance_decision: [
        "PENDING",
        "APPROVED",
        "CHANGES_REQUESTED",
        "REJECTED",
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
      marketing_channel_type: [
        "PAID",
        "ORGANIC",
        "REFERRAL",
        "DIRECT",
        "EVENT",
        "OTHER",
      ],
      marketing_cost_item_type: ["ONLINE", "OFFLINE"],
      marketing_cost_type: ["CPM", "CPC", "CPL", "FIXED", "RETAINER"],
      referral_status: [
        "Closed",
        "In Process",
        "New",
        "Paid",
        "Pending",
        "Referred",
        "Rejected",
      ],
      seat_request_status: ["PENDING", "APPROVED", "REJECTED", "FULFILLED"],
      submission_status: ["PENDING_REVIEW", "APPROVED", "REJECTED"],
      subscription_status: ["ACTIVE", "PAUSED", "CANCELLED", "OVERDUE"],
      tenancy_type: ["AGENCY_BROKERAGE_CONSULTANCY", "BUILDER_DEVELOPER"],
      ticket_category: [
        "LISTINGS_INVENTORY",
        "BILLING_PLAN",
        "API_INTEGRATIONS",
        "ONBOARDING_MIGRATION",
        "SECURITY_ACCESS",
        "COMPLIANCE_LEGAL",
        "PERFORMANCE_RELIABILITY",
        "OTHER",
      ],
      ticket_priority: ["P1", "P2", "P3", "P4"],
      ticket_status: [
        "OPEN",
        "PENDING_CUSTOMER",
        "PENDING_INTERNAL",
        "RESOLVED",
        "CLOSED",
      ],
      ticket_type: ["INCIDENT", "QUESTION", "TASK", "FEEDBACK"],
      verification_kind: ["PAN", "GST", "RERA", "BANK", "IDENTITY"],
      verification_status: ["PENDING", "VERIFIED", "REJECTED"],
    },
  },
} as const
