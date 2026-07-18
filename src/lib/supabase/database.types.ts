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
      academy_quest_progress: {
        Row: {
          completed_at: string
          id: string
          quest_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          quest_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          quest_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_quest_progress_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "academy_quests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_quest_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_quests: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          quest_key: string
          reward_currency: number
          reward_item_id: string | null
          reward_item_quantity: number
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          quest_key: string
          reward_currency?: number
          reward_item_id?: string | null
          reward_item_quantity?: number
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          quest_key?: string
          reward_currency?: number
          reward_item_id?: string | null
          reward_item_quantity?: number
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_quests_reward_item_id_fkey"
            columns: ["reward_item_id"]
            isOneToOne: false
            referencedRelation: "game_items"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_links: {
        Row: {
          click_count: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          slot_number: number
          title: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          slot_number: number
          title: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          click_count?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          slot_number?: number
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_deals: {
        Row: {
          budget_amount: number | null
          category: string
          completed_at: string | null
          created_at: string
          description: string
          external_asset_url: string | null
          id: string
          posted_as: string
          posted_by: string
          slots_total: number
          status: string
          title: string
        }
        Insert: {
          budget_amount?: number | null
          category?: string
          completed_at?: string | null
          created_at?: string
          description: string
          external_asset_url?: string | null
          id?: string
          posted_as: string
          posted_by: string
          slots_total?: number
          status?: string
          title: string
        }
        Update: {
          budget_amount?: number | null
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          external_asset_url?: string | null
          id?: string
          posted_as?: string
          posted_by?: string
          slots_total?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_deals_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crafting_recipe_ingredients: {
        Row: {
          item_id: string
          quantity: number
          recipe_id: string
        }
        Insert: {
          item_id: string
          quantity: number
          recipe_id: string
        }
        Update: {
          item_id?: string
          quantity?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crafting_recipe_ingredients_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "game_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crafting_recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "crafting_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      crafting_recipes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          result_item_id: string
          result_quantity: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          result_item_id: string
          result_quantity?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          result_item_id?: string
          result_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "crafting_recipes_result_item_id_fkey"
            columns: ["result_item_id"]
            isOneToOne: false
            referencedRelation: "game_items"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_replies: {
        Row: {
          applicant_id: string
          created_at: string
          deal_id: string
          id: string
          message: string | null
          status: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          deal_id: string
          id?: string
          message?: string | null
          status?: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          deal_id?: string
          id?: string
          message?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_replies_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_replies_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "brand_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_reviews: {
        Row: {
          comment: string | null
          created_at: string
          deal_id: string
          id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          deal_id: string
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_reviews_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "brand_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          page_path: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          page_path: string
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          page_path?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      followers: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          season_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          season_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_flags: {
        Row: {
          admin_action: string | null
          detected_at: string
          flag_type: string
          id: string
          reason: string
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          user_id: string
        }
        Insert: {
          admin_action?: string | null
          detected_at?: string
          flag_type: string
          id?: string
          reason: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_id: string
        }
        Update: {
          admin_action?: string | null
          detected_at?: string
          flag_type?: string
          id?: string
          reason?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_items: {
        Row: {
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          is_tradeable: boolean
          item_key: string
          item_type: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_tradeable?: boolean
          item_key: string
          item_type: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_tradeable?: boolean
          item_key?: string
          item_type?: string
          name?: string
        }
        Relationships: []
      }
      game_stats: {
        Row: {
          currency: number
          follow_tokens_earned: number
          id: string
          is_subscribed: boolean
          last_login_date: string | null
          level: number
          season_id: string
          subscription_expires_at: string | null
          subscription_started_at: string | null
          tier: string | null
          total_login_days: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          currency?: number
          follow_tokens_earned?: number
          id?: string
          is_subscribed?: boolean
          last_login_date?: string | null
          level?: number
          season_id: string
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          tier?: string | null
          total_login_days?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          currency?: number
          follow_tokens_earned?: number
          id?: string
          is_subscribed?: boolean
          last_login_date?: string | null
          level?: number
          season_id?: string
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          tier?: string | null
          total_login_days?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_stats_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_price_bands: {
        Row: {
          avg_price: number
          batch_number: number
          effective_from: string
          id: string
          item_id: string
          max_price: number
          min_price: number
          season_id: string
        }
        Insert: {
          avg_price: number
          batch_number: number
          effective_from?: string
          id?: string
          item_id: string
          max_price: number
          min_price: number
          season_id: string
        }
        Update: {
          avg_price?: number
          batch_number?: number
          effective_from?: string
          id?: string
          item_id?: string
          max_price?: number
          min_price?: number
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_price_bands_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "game_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_price_bands_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          created_at: string
          id: string
          item_id: string
          price_per_unit: number
          quantity: number
          season_id: string
          seller_id: string
          slot_number: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          price_per_unit: number
          quantity: number
          season_id: string
          seller_id: string
          slot_number: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          price_per_unit?: number
          quantity?: number
          season_id?: string
          seller_id?: string
          slot_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "game_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_transactions: {
        Row: {
          buyer_id: string
          id: string
          listing_id: string
          quantity: number
          total_price: number
          transacted_at: string
        }
        Insert: {
          buyer_id: string
          id?: string
          listing_id: string
          quantity: number
          total_price: number
          transacted_at?: string
        }
        Update: {
          buyer_id?: string
          id?: string
          listing_id?: string
          quantity?: number
          total_price?: number
          transacted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      niche_tags: {
        Row: {
          created_at: string
          id: string
          label: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          slug?: string
        }
        Relationships: []
      }
      platform_commerce_stats: {
        Row: {
          clicks: number | null
          commission: number | null
          created_at: string
          id: string
          orders: number | null
          platform: string
          revenue: number | null
          stat_date: string
          user_id: string
        }
        Insert: {
          clicks?: number | null
          commission?: number | null
          created_at?: string
          id?: string
          orders?: number | null
          platform: string
          revenue?: number | null
          stat_date: string
          user_id: string
        }
        Update: {
          clicks?: number | null
          commission?: number | null
          created_at?: string
          id?: string
          orders?: number | null
          platform?: string
          revenue?: number | null
          stat_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_commerce_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_content_stats: {
        Row: {
          clicks: number | null
          created_at: string
          engagement: number | null
          id: string
          platform: string
          reach: number | null
          stat_date: string
          user_id: string
        }
        Insert: {
          clicks?: number | null
          created_at?: string
          engagement?: number | null
          id?: string
          platform: string
          reach?: number | null
          stat_date: string
          user_id: string
        }
        Update: {
          clicks?: number | null
          created_at?: string
          engagement?: number | null
          id?: string
          platform?: string
          reach?: number | null
          stat_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_content_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_inventory: {
        Row: {
          id: string
          item_id: string
          quantity: number
          season_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          quantity?: number
          season_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          quantity?: number
          season_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "game_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_inventory_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          sort_order: number
          storage_path: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          storage_path: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_contacts: {
        Row: {
          contact_email: string | null
          contact_facebook: string | null
          contact_line_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_email?: string | null
          contact_facebook?: string | null
          contact_line_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_email?: string | null
          contact_facebook?: string | null
          contact_line_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_niche_tags: {
        Row: {
          created_at: string
          profile_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_niche_tags_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_niche_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "niche_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_views: {
        Row: {
          id: string
          profile_id: string
          view_date: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          profile_id: string
          view_date?: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          profile_id?: string
          view_date?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          brand_name: string | null
          brand_status: string
          brand_website: string | null
          created_at: string
          display_name: string | null
          facebook_url: string | null
          has_brand: boolean
          id: string
          instagram_url: string | null
          is_admin: boolean
          is_official_brand: boolean
          music_url: string | null
          theme_preset: string
          tiktok_url: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          brand_name?: string | null
          brand_status?: string
          brand_website?: string | null
          created_at?: string
          display_name?: string | null
          facebook_url?: string | null
          has_brand?: boolean
          id: string
          instagram_url?: string | null
          is_admin?: boolean
          is_official_brand?: boolean
          music_url?: string | null
          theme_preset?: string
          tiktok_url?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          brand_name?: string | null
          brand_status?: string
          brand_website?: string | null
          created_at?: string
          display_name?: string | null
          facebook_url?: string | null
          has_brand?: boolean
          id?: string
          instagram_url?: string | null
          is_admin?: boolean
          is_official_brand?: boolean
          music_url?: string | null
          theme_preset?: string
          tiktok_url?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      season_notifications_log: {
        Row: {
          id: string
          notice_type: string
          season_id: string
          sent_at: string
        }
        Insert: {
          id?: string
          notice_type: string
          season_id: string
          sent_at?: string
        }
        Update: {
          id?: string
          notice_type?: string
          season_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_notifications_log_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_rewards: {
        Row: {
          awarded_at: string
          id: string
          rank_in_season: number | null
          season_id: string
          trophy_name: string
          trophy_tier: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          id?: string
          rank_in_season?: number | null
          season_id: string
          trophy_name: string
          trophy_tier: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          id?: string
          rank_in_season?: number | null
          season_id?: string
          trophy_name?: string
          trophy_tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_rewards_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          season_number: number
          starts_at: string
          status: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          season_number: number
          starts_at: string
          status?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          season_number?: number
          starts_at?: string
          status?: string
        }
        Relationships: []
      }
      signup_audit_log: {
        Row: {
          created_at: string
          id: string
          ip_address: unknown
          turnstile_verified: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: unknown
          turnstile_verified?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: unknown
          turnstile_verified?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_cancellations: {
        Row: {
          cancelled_at: string
          cancelled_by: string
          id: string
          refund_status: string
          refunded_at: string | null
          season_id: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string
          cancelled_by: string
          id?: string
          refund_status?: string
          refunded_at?: string | null
          season_id: string
          user_id: string
        }
        Update: {
          cancelled_at?: string
          cancelled_by?: string
          id?: string
          refund_status?: string
          refunded_at?: string | null
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_cancellations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cancellations_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cancellations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_used: boolean
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      follower_by_season: {
        Row: {
          ends_at: string | null
          follower_count: number | null
          profile_id: string | null
          season_id: string | null
          season_number: number | null
          starts_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      follower_totals: {
        Row: {
          profile_id: string | null
          total_followers: number | null
        }
        Relationships: [
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_review_summary: {
        Row: {
          average_rating: number | null
          positive_pct: number | null
          profile_id: string | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_reviews_reviewee_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_tier_badge: {
        Row: {
          season_id: string | null
          tier: string | null
          user_id: string | null
        }
        Insert: {
          season_id?: string | null
          tier?: string | null
          user_id?: string | null
        }
        Update: {
          season_id?: string | null
          tier?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_stats_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_deal_reply: { Args: { p_reply_id: string }; Returns: undefined }
      activate_season: { Args: { p_season_id: string }; Returns: undefined }
      admin_cancel_subscription: {
        Args: { p_admin_id: string; p_season_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_mark_brand_processing: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      admin_reject_brand: { Args: { p_profile_id: string }; Returns: undefined }
      admin_resolve_fraud_flag: {
        Args: { p_action: string; p_admin_id: string; p_flag_id: string }
        Returns: undefined
      }
      auto_end_expired_seasons: { Args: never; Returns: undefined }
      cancel_brand_deal: { Args: { p_deal_id: string }; Returns: undefined }
      check_and_claim_academy_quests: {
        Args: never
        Returns: {
          quest_key: string
          reward_currency: number
          reward_item_id: string
          reward_item_quantity: number
          title: string
        }[]
      }
      check_season_notifications: { Args: never; Returns: undefined }
      complete_deal: { Args: { p_deal_id: string }; Returns: undefined }
      compute_tier: {
        Args: { p_days: number; p_is_subscribed: boolean }
        Returns: string
      }
      count_accepted_replies: { Args: { p_deal_id: string }; Returns: number }
      distribute_season_rewards: {
        Args: { p_season_id: string }
        Returns: undefined
      }
      end_season: { Args: { p_season_id: string }; Returns: undefined }
      get_login_stats: {
        Args: never
        Returns: {
          active_affiliate_links: number
          season_users: number
          total_users: number
        }[]
      }
      get_marketplace_tax_rate: { Args: { p_tier: string }; Returns: number }
      get_matched_contact: {
        Args: { p_deal_id: string }
        Returns: {
          contact_email: string
          contact_facebook: string
          contact_line_id: string
          counterpart_user_id: string
        }[]
      }
      get_max_affiliate_slots: { Args: { p_user_id: string }; Returns: number }
      get_max_storage_big_slots: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_server_time: { Args: never; Returns: string }
      purchase_from_listing: {
        Args: { p_listing_id: string; p_quantity: number }
        Returns: undefined
      }
      recalc_price_band: {
        Args: { p_item_id: string; p_season_id: string }
        Returns: undefined
      }
      record_daily_login: { Args: { p_season_id: string }; Returns: undefined }
      record_signup_ip: {
        Args: {
          p_ip: unknown
          p_turnstile_verified: boolean
          p_user_agent: string
          p_user_id: string
        }
        Returns: undefined
      }
      redeem_subscription_code: {
        Args: { p_code: string; p_season_id: string }
        Returns: undefined
      }
      reject_deal_reply: { Args: { p_reply_id: string }; Returns: undefined }
      resubmit_brand_info: {
        Args: { p_brand_name: string; p_brand_website: string }
        Returns: undefined
      }
      submit_deal_review: {
        Args: {
          p_comment?: string
          p_deal_id: string
          p_rating: number
          p_reviewee_id: string
        }
        Returns: undefined
      }
      subscribe_player: { Args: { p_season_id: string }; Returns: undefined }
      toggle_brand_status: { Args: never; Returns: boolean }
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
    Enums: {},
  },
} as const
