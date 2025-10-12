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
      base_maps: {
        Row: {
          attribution: string | null
          created_at: string
          file_path: string
          id: string
          license: string | null
          region: string
          source_url: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          attribution?: string | null
          created_at?: string
          file_path: string
          id?: string
          license?: string | null
          region: string
          source_url?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          attribution?: string | null
          created_at?: string
          file_path?: string
          id?: string
          license?: string | null
          region?: string
          source_url?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      chat_history: {
        Row: {
          answer: string
          created_at: string | null
          id: string
          question: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: string
          question: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: string
          question?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      hotspots: {
        Row: {
          created_at: string
          id: string
          poster_id: string
          snippet: string | null
          tags: string[] | null
          title: string
          x: number
          y: number
          zoom: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          poster_id: string
          snippet?: string | null
          tags?: string[] | null
          title: string
          x: number
          y: number
          zoom?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          poster_id?: string
          snippet?: string | null
          tags?: string[] | null
          title?: string
          x?: number
          y?: number
          zoom?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hotspots_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "posters"
            referencedColumns: ["id"]
          },
        ]
      }
      overlays: {
        Row: {
          base_map_id: string
          created_at: string
          file_path: string
          id: string
          notes: string | null
          theme: string
          year: number
        }
        Insert: {
          base_map_id: string
          created_at?: string
          file_path: string
          id?: string
          notes?: string | null
          theme: string
          year: number
        }
        Update: {
          base_map_id?: string
          created_at?: string
          file_path?: string
          id?: string
          notes?: string | null
          theme?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "overlays_base_map_id_fkey"
            columns: ["base_map_id"]
            isOneToOne: false
            referencedRelation: "base_maps"
            referencedColumns: ["id"]
          },
        ]
      }
      posters: {
        Row: {
          created_at: string
          created_by: string | null
          credit: string | null
          dzi_path: string
          id: string
          license_status: string
          thumb_url: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit?: string | null
          dzi_path: string
          id?: string
          license_status: string
          thumb_url?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit?: string | null
          dzi_path?: string
          id?: string
          license_status?: string
          thumb_url?: string | null
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          secondary_email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          secondary_email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          secondary_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      request_logs: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          response_time_ms: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          response_time_ms?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          response_time_ms?: number | null
          user_id?: string
        }
        Relationships: []
      }
      trusted_sources: {
        Row: {
          created_at: string
          domain: string
          id: number
          label: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: number
          label: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: number
          label?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "admin"
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
      app_role: ["user", "admin"],
    },
  },
} as const
