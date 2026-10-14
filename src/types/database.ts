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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      envelopes: {
        Row: {
          achieved_at: string | null
          archived_at: string | null
          cap_amount: number | null
          cap_period: Database["public"]["Enums"]["cap_period"]
          created_at: string
          fill_rule: Database["public"]["Enums"]["fill_rule"]
          fill_value: number
          group_id: string | null
          id: string
          name: string
          rollover: boolean
          sort_order: number
          sweep_to_envelope_id: string | null
          target_date: string | null
          target_minor: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          archived_at?: string | null
          cap_amount?: number | null
          cap_period?: Database["public"]["Enums"]["cap_period"]
          created_at?: string
          fill_rule: Database["public"]["Enums"]["fill_rule"]
          fill_value?: number
          group_id?: string | null
          id?: string
          name: string
          rollover?: boolean
          sort_order?: number
          sweep_to_envelope_id?: string | null
          target_date?: string | null
          target_minor?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          archived_at?: string | null
          cap_amount?: number | null
          cap_period?: Database["public"]["Enums"]["cap_period"]
          created_at?: string
          fill_rule?: Database["public"]["Enums"]["fill_rule"]
          fill_value?: number
          group_id?: string | null
          id?: string
          name?: string
          rollover?: boolean
          sort_order?: number
          sweep_to_envelope_id?: string | null
          target_date?: string | null
          target_minor?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "envelopes_group_fkey"
            columns: ["user_id", "group_id"]
            isOneToOne: false
            referencedRelation: "envelopes"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "envelopes_sweep_to_fkey"
            columns: ["user_id", "sweep_to_envelope_id"]
            isOneToOne: false
            referencedRelation: "envelopes"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      imports: {
        Row: {
          area: Database["public"]["Enums"]["import_area"]
          created_at: string
          file_name: string
          format_version: number
          id: string
          row_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          area: Database["public"]["Enums"]["import_area"]
          created_at?: string
          file_name: string
          format_version?: number
          id?: string
          row_count: number
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: Database["public"]["Enums"]["import_area"]
          created_at?: string
          file_name?: string
          format_version?: number
          id?: string
          row_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      movements: {
        Row: {
          amount_minor: number
          batch_id: string | null
          created_at: string
          envelope_from: string | null
          envelope_to: string | null
          id: string
          import_id: string | null
          kind: Database["public"]["Enums"]["movement_kind"]
          note: string | null
          occurred_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          batch_id?: string | null
          created_at?: string
          envelope_from?: string | null
          envelope_to?: string | null
          id?: string
          import_id?: string | null
          kind: Database["public"]["Enums"]["movement_kind"]
          note?: string | null
          occurred_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          batch_id?: string | null
          created_at?: string
          envelope_from?: string | null
          envelope_to?: string | null
          id?: string
          import_id?: string | null
          kind?: Database["public"]["Enums"]["movement_kind"]
          note?: string | null
          occurred_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movements_envelope_from_fkey"
            columns: ["user_id", "envelope_from"]
            isOneToOne: false
            referencedRelation: "envelopes"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "movements_envelope_to_fkey"
            columns: ["user_id", "envelope_to"]
            isOneToOne: false
            referencedRelation: "envelopes"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "movements_import_fkey"
            columns: ["user_id", "import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      period_closures: {
        Row: {
          action: string
          batch_id: string | null
          created_at: string
          envelope_id: string
          id: string
          period_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          batch_id?: string | null
          created_at?: string
          envelope_id: string
          id?: string
          period_start: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          batch_id?: string | null
          created_at?: string
          envelope_id?: string
          id?: string
          period_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_closures_envelope_fkey"
            columns: ["user_id", "envelope_id"]
            isOneToOne: false
            referencedRelation: "envelopes"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          currency: string
          currency_decimals: number
          display_name: string | null
          id: string
          onboarded_at: string | null
          theme: string
          timezone: string
          updated_at: string
          week_starts_on: number
          weight_unit: string
        }
        Insert: {
          created_at?: string
          currency?: string
          currency_decimals?: number
          display_name?: string | null
          id: string
          onboarded_at?: string | null
          theme?: string
          timezone?: string
          updated_at?: string
          week_starts_on?: number
          weight_unit?: string
        }
        Update: {
          created_at?: string
          currency?: string
          currency_decimals?: number
          display_name?: string | null
          id?: string
          onboarded_at?: string | null
          theme?: string
          timezone?: string
          updated_at?: string
          week_starts_on?: number
          weight_unit?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      cap_period: "month" | "none"
      fill_rule: "fixed" | "percent" | "residual"
      import_area: "movements" | "tasks" | "schedule" | "routines" | "workouts"
      movement_kind: "income" | "expense" | "transfer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      cap_period: ["month", "none"],
      fill_rule: ["fixed", "percent", "residual"],
      import_area: ["movements", "tasks", "schedule", "routines", "workouts"],
      movement_kind: ["income", "expense", "transfer"],
    },
  },
} as const
