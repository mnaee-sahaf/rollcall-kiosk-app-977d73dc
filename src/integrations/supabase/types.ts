export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      attendance_events: {
        Row: {
          class_id: string;
          day: string;
          id: string;
          kiosk_session_id: string | null;
          marked_by: string | null;
          method: Database["public"]["Enums"]["attendance_method"];
          note: string | null;
          occurred_at: string;
          status: Database["public"]["Enums"]["attendance_status"];
          student_id: string;
        };
        Insert: {
          class_id: string;
          day?: string;
          id?: string;
          kiosk_session_id?: string | null;
          marked_by?: string | null;
          method: Database["public"]["Enums"]["attendance_method"];
          note?: string | null;
          occurred_at?: string;
          status: Database["public"]["Enums"]["attendance_status"];
          student_id: string;
        };
        Update: {
          class_id?: string;
          day?: string;
          id?: string;
          kiosk_session_id?: string | null;
          marked_by?: string | null;
          method?: Database["public"]["Enums"]["attendance_method"];
          note?: string | null;
          occurred_at?: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_events_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_events_kiosk_session_id_fkey";
            columns: ["kiosk_session_id"];
            isOneToOne: false;
            referencedRelation: "kiosk_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_events_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          created_at: string;
          grade: string | null;
          id: string;
          name: string;
          teacher_id: string;
        };
        Insert: {
          created_at?: string;
          grade?: string | null;
          id?: string;
          name: string;
          teacher_id: string;
        };
        Update: {
          created_at?: string;
          grade?: string | null;
          id?: string;
          name?: string;
          teacher_id?: string;
        };
        Relationships: [];
      };
      kiosk_sessions: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          revoked_at: string | null;
          starts_at: string;
          token: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          created_by: string;
          expires_at: string;
          id?: string;
          revoked_at?: string | null;
          starts_at?: string;
          token?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          revoked_at?: string | null;
          starts_at?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kiosk_sessions_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          school_name: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          school_name?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          school_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      school_settings: {
        Row: {
          absent_after_time: string;
          country: string | null;
          day_cutoff_time: string;
          devices: string[];
          id: string;
          industry: string | null;
          logo_url: string | null;
          onboarded_at: string | null;
          org_size: string | null;
          phone: string | null;
          primary_role: string | null;
          referral_source: string | null;
          school_name: string | null;
          singleton: boolean;
          timezone: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          absent_after_time?: string;
          country?: string | null;
          day_cutoff_time?: string;
          devices?: string[];
          id?: string;
          industry?: string | null;
          logo_url?: string | null;
          onboarded_at?: string | null;
          org_size?: string | null;
          phone?: string | null;
          primary_role?: string | null;
          referral_source?: string | null;
          school_name?: string | null;
          singleton?: boolean;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          absent_after_time?: string;
          country?: string | null;
          day_cutoff_time?: string;
          devices?: string[];
          id?: string;
          industry?: string | null;
          logo_url?: string | null;
          onboarded_at?: string | null;
          org_size?: string | null;
          phone?: string | null;
          primary_role?: string | null;
          referral_source?: string | null;
          school_name?: string | null;
          singleton?: boolean;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      student_qr_tokens: {
        Row: {
          id: string;
          issued_at: string;
          issued_by: string | null;
          reason: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          student_id: string;
          token: string;
        };
        Insert: {
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          student_id: string;
          token: string;
        };
        Update: {
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          student_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_qr_tokens_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          active: boolean;
          class_id: string;
          created_at: string;
          external_id: string | null;
          full_name: string;
          guardian_email: string | null;
          guardian_phone: string | null;
          id: string;
          photo_url: string | null;
          qr_last_sent_at: string | null;
          qr_token: string;
        };
        Insert: {
          active?: boolean;
          class_id: string;
          created_at?: string;
          external_id?: string | null;
          full_name: string;
          guardian_email?: string | null;
          guardian_phone?: string | null;
          id?: string;
          photo_url?: string | null;
          qr_last_sent_at?: string | null;
          qr_token?: string;
        };
        Update: {
          active?: boolean;
          class_id?: string;
          created_at?: string;
          external_id?: string | null;
          full_name?: string;
          guardian_email?: string | null;
          guardian_phone?: string | null;
          id?: string;
          photo_url?: string | null;
          qr_last_sent_at?: string | null;
          qr_token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_invites: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          token: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          token?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      waitlist_signups: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          school: string | null;
          source: string;
          user_agent: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          school?: string | null;
          source?: string;
          user_agent?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          school?: string | null;
          source?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "teacher";
      attendance_method: "kiosk" | "manual";
      attendance_status: "present" | "absent" | "late";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "teacher"],
      attendance_method: ["kiosk", "manual"],
      attendance_status: ["present", "absent", "late"],
    },
  },
} as const;
