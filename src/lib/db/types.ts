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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      apps: {
        Row: {
          created_at: string
          id: string
          industry_tag_id: string | null
          logo_path: string | null
          name: string
          owner_id: string
          platform: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          industry_tag_id?: string | null
          logo_path?: string | null
          name: string
          owner_id?: string
          platform: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          industry_tag_id?: string | null
          logo_path?: string | null
          name?: string
          owner_id?: string
          platform?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apps_industry_tag_id_fkey"
            columns: ["industry_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      facets: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      flow_screens: {
        Row: {
          flow_id: string
          position: number
          screen_id: string
        }
        Insert: {
          flow_id: string
          position: number
          screen_id: string
        }
        Update: {
          flow_id?: string
          position?: number
          screen_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_screens_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_screens_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      flows: {
        Row: {
          app_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string
        }
        Update: {
          app_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flows_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      screen_tags: {
        Row: {
          screen_id: string
          tag_id: string
        }
        Insert: {
          screen_id: string
          tag_id: string
        }
        Update: {
          screen_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_tags_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      screens: {
        Row: {
          app_id: string
          captured_at: string
          created_at: string
          height: number | null
          id: string
          image_path: string
          notes: string | null
          owner_id: string
          search_vector: unknown
          thumb_path: string | null
          width: number | null
        }
        Insert: {
          app_id: string
          captured_at?: string
          created_at?: string
          height?: number | null
          id?: string
          image_path: string
          notes?: string | null
          owner_id?: string
          search_vector?: unknown
          thumb_path?: string | null
          width?: number | null
        }
        Update: {
          app_id?: string
          captured_at?: string
          created_at?: string
          height?: number | null
          id?: string
          image_path?: string
          notes?: string | null
          owner_id?: string
          search_vector?: unknown
          thumb_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "screens_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          active: boolean
          confirmed: boolean
          created_at: string
          description: string | null
          home_url: string
          id: string
          kind: string
          mediums: string[]
          name: string
          pricing: string | null
          sort_order: number
          thumb_path: string | null
          url_template: string | null
        }
        Insert: {
          active?: boolean
          confirmed?: boolean
          created_at?: string
          description?: string | null
          home_url: string
          id?: string
          kind: string
          mediums?: string[]
          name: string
          pricing?: string | null
          sort_order?: number
          thumb_path?: string | null
          url_template?: string | null
        }
        Update: {
          active?: boolean
          confirmed?: boolean
          created_at?: string
          description?: string | null
          home_url?: string
          id?: string
          kind?: string
          mediums?: string[]
          name?: string
          pricing?: string | null
          sort_order?: number
          thumb_path?: string | null
          url_template?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          created_by: string | null
          facet_id: string
          id: string
          label: string
          slug: string
          synonyms: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          facet_id: string
          id?: string
          label: string
          slug: string
          synonyms?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          facet_id?: string
          id?: string
          label?: string
          slug?: string
          synonyms?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "tags_facet_id_fkey"
            columns: ["facet_id"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      screen_tag_counts: {
        Args: never
        Returns: {
          screens: number
          tag_id: string
        }[]
      }
      search_screens: {
        Args: {
          p_before_at?: string
          p_before_id?: string
          p_limit?: number
          p_query?: string
          p_tag_ids?: string[]
        }
        Returns: {
          app_id: string
          app_name: string
          app_platform: string
          captured_at: string
          height: number
          id: string
          image_path: string
          tag_ids: string[]
          thumb_path: string
          width: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
