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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      maintenance_requests: {
        Row: {
          assigned_at: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          priority: string
          property_id: string
          status: string
          title: string
          unit_id: string | null
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          priority?: string
          property_id: string
          status?: string
          title: string
          unit_id?: string | null
          updated_at?: string
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          priority?: string
          property_id?: string
          status?: string
          title?: string
          unit_id?: string | null
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          sender: string
          status: string
          subject: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          id?: string
          sender?: string
          status?: string
          subject?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          sender?: string
          status?: string
          subject?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          payment_date: string
          payment_method: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          payment_date: string
          payment_method: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          payment_date?: string
          payment_method?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email_notifications: boolean | null
          first_name: string | null
          id: string
          last_name: string | null
          marketing_communications: boolean | null
          phone: string | null
          push_notifications: boolean | null
          role: string | null
          sms_notifications: boolean | null
          theme: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email_notifications?: boolean | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          marketing_communications?: boolean | null
          phone?: string | null
          push_notifications?: boolean | null
          role?: string | null
          sms_notifications?: boolean | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email_notifications?: boolean | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          marketing_communications?: boolean | null
          phone?: string | null
          push_notifications?: boolean | null
          role?: string | null
          sms_notifications?: boolean | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          city: string
          created_at: string
          current_value: number | null
          down_payment: number | null
          id: string
          name: string
          occupancy_status: string | null
          postal_code: string | null
          property_type: string
          province: string
          purchase_date: string | null
          purchase_price: number
          timezone: string
          units: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          current_value?: number | null
          down_payment?: number | null
          id?: string
          name: string
          occupancy_status?: string | null
          postal_code?: string | null
          property_type: string
          province: string
          purchase_date?: string | null
          purchase_price: number
          timezone: string
          units?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          current_value?: number | null
          down_payment?: number | null
          id?: string
          name?: string
          occupancy_status?: string | null
          postal_code?: string | null
          property_type?: string
          province?: string
          purchase_date?: string | null
          purchase_price?: number
          timezone?: string
          units?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      property_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          frequency: string
          id: string
          property_id: string
          unit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          property_id: string
          unit_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          property_id?: string
          unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_expenses_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      property_income: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          frequency: string
          id: string
          property_id: string
          unit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          property_id: string
          unit_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          property_id?: string
          unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_income_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_income_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_documents: {
        Row: {
          created_at: string
          document_title: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_title: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_title?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          balance: number | null
          created_at: string
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          id: string
          lease_end: string
          lease_start: string
          monthly_rent: number
          name: string
          phone: string | null
          property_id: string
          relationship_score: number | null
          security_deposit: number | null
          status: string
          unit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          id?: string
          lease_end: string
          lease_start: string
          monthly_rent: number
          name: string
          phone?: string | null
          property_id: string
          relationship_score?: number | null
          security_deposit?: number | null
          status?: string
          unit_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          id?: string
          lease_end?: string
          lease_start?: string
          monthly_rent?: number
          name?: string
          phone?: string | null
          property_id?: string
          relationship_score?: number | null
          security_deposit?: number | null
          status?: string
          unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          current_lease_end: string | null
          current_lease_start: string | null
          current_tenant: string | null
          description: string | null
          id: string
          incoming_lease_end: string | null
          incoming_lease_start: string | null
          incoming_tenant: string | null
          property_id: string
          required_deposit: number | null
          required_rent: number | null
          size_sqft: number | null
          status: string
          status_until: string | null
          unit_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_lease_end?: string | null
          current_lease_start?: string | null
          current_tenant?: string | null
          description?: string | null
          id?: string
          incoming_lease_end?: string | null
          incoming_lease_start?: string | null
          incoming_tenant?: string | null
          property_id: string
          required_deposit?: number | null
          required_rent?: number | null
          size_sqft?: number | null
          status?: string
          status_until?: string | null
          unit_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_lease_end?: string | null
          current_lease_start?: string | null
          current_tenant?: string | null
          description?: string | null
          id?: string
          incoming_lease_end?: string | null
          incoming_lease_start?: string | null
          incoming_tenant?: string | null
          property_id?: string
          required_deposit?: number | null
          required_rent?: number | null
          size_sqft?: number | null
          status?: string
          status_until?: string | null
          unit_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          city: string | null
          company_name: string | null
          contact_email: string | null
          contact_phone: string
          created_at: string
          id: string
          is_preferred: boolean | null
          jobs_completed: number | null
          name: string
          notes: string | null
          postal_code: string | null
          province: string | null
          rating: number | null
          service_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone: string
          created_at?: string
          id?: string
          is_preferred?: boolean | null
          jobs_completed?: number | null
          name: string
          notes?: string | null
          postal_code?: string | null
          province?: string | null
          rating?: number | null
          service_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string
          created_at?: string
          id?: string
          is_preferred?: boolean | null
          jobs_completed?: number | null
          name?: string
          notes?: string | null
          postal_code?: string | null
          province?: string | null
          rating?: number | null
          service_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          type: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          type?: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          type?: string
          used?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_tenant_info: {
        Args: never
        Returns: {
          property_id: string
          tenant_id: string
          unit_id: string
        }[]
      }
      get_current_user_email: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "property_manager" | "tenant"
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
      app_role: ["admin", "property_manager", "tenant"],
    },
  },
} as const
