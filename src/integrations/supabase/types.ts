export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attendance_events: {
        Row: {
          class_id: string
          day: string
          id: string
          kiosk_session_id: string | null
          marked_by: string | null
          method: Database["public"]["Enums"]["attendance_method"]
          note: string | null
          occurred_at: string
          org_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          class_id: string
          day?: string
          id?: string
          kiosk_session_id?: string | null
          marked_by?: string | null
          method: Database["public"]["Enums"]["attendance_method"]
          note?: string | null
          occurred_at?: string
          org_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          class_id?: string
          day?: string
          id?: string
          kiosk_session_id?: string | null
          marked_by?: string | null
          method?: Database["public"]["Enums"]["attendance_method"]
          note?: string | null
          occurred_at?: string
          org_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_kiosk_session_id_fkey"
            columns: ["kiosk_session_id"]
            isOneToOne: false
            referencedRelation: "kiosk_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          grade: string | null
          id: string
          name: string
          org_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          grade?: string | null
          id?: string
          name: string
          org_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          grade?: string | null
          id?: string
          name?: string
          org_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_sessions: {
        Row: {
          class_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          org_id: string
          revoked_at: string | null
          starts_at: string
          token: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          org_id: string
          revoked_at?: string | null
          starts_at?: string
          token?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          org_id?: string
          revoked_at?: string | null
          starts_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          absent_after_time: string
          country: string | null
          created_at: string
          created_by: string | null
          day_cutoff_time: string
          devices: string[]
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          onboarded_at: string | null
          org_size: string | null
          phone: string | null
          primary_role: string | null
          referral_source: string | null
          timezone: string
        }
        Insert: {
          absent_after_time?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          day_cutoff_time?: string
          devices?: string[]
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          onboarded_at?: string | null
          org_size?: string | null
          phone?: string | null
          primary_role?: string | null
          referral_source?: string | null
          timezone?: string
        }
        Update: {
          absent_after_time?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          day_cutoff_time?: string
          devices?: string[]
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          onboarded_at?: string | null
          org_size?: string | null
          phone?: string | null
          primary_role?: string | null
          referral_source?: string | null
          timezone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          last_active_org_id: string | null
          school_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          last_active_org_id?: string | null
          school_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          last_active_org_id?: string | null
          school_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_last_active_org_id_fkey"
            columns: ["last_active_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      student_qr_tokens: {
        Row: {
          id: string
          issued_at: string
          issued_by: string | null
          org_id: string
          reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          student_id: string
          token: string
        }
        Insert: {
          id?: string
          issued_at?: string
          issued_by?: string | null
          org_id: string
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          student_id: string
          token: string
        }
        Update: {
          id?: string
          issued_at?: string
          issued_by?: string | null
          org_id?: string
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          student_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_qr_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_qr_tokens_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          active: boolean
          class_id: string
          created_at: string
          external_id: string | null
          full_name: string
          guardian_email: string | null
          guardian_phone: string | null
          id: string
          org_id: string
          photo_url: string | null
          qr_last_sent_at: string | null
          qr_token: string
        }
        Insert: {
          active?: boolean
          class_id: string
          created_at?: string
          external_id?: string | null
          full_name: string
          guardian_email?: string | null
          guardian_phone?: string | null
          id?: string
          org_id: string
          photo_url?: string | null
          qr_last_sent_at?: string | null
          qr_token?: string
        }
        Update: {
          active?: boolean
          class_id?: string
          created_at?: string
          external_id?: string | null
          full_name?: string
          guardian_email?: string | null
          guardian_phone?: string | null
          id?: string
          org_id?: string
          photo_url?: string | null
          qr_last_sent_at?: string | null
          qr_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          school: string | null
          source: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          school?: string | null
          source?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          school?: string | null
          source?: string
          user_agent?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_org_member: { Args: { org: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "member"
      attendance_method: "kiosk" | "manual"
      attendance_status: "present" | "absent" | "late"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["owner", "admin", "manager", "member"],
      attendance_method: ["kiosk", "manual"],
      attendance_status: ["present", "absent", "late"],
    },
  },
} as const

