
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "account_snapshots": {
                  Row: {
                    "account_id": string,"captured_at": string,"created_at": string,"created_by": string | null,"followers": number,"following": number | null,"id": string,"media_count": number | null,"profile_views": number | null,"reach_day": number | null,"total_likes": number | null,"total_views": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"captured_at"?: string,"created_at"?: string,"created_by"?: string | null,"followers"?: number,"following"?: number | null,"id"?: string,"media_count"?: number | null,"profile_views"?: number | null,"reach_day"?: number | null,"total_likes"?: number | null,"total_views"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "account_id"?: string,"captured_at"?: string,"created_at"?: string,"created_by"?: string | null,"followers"?: number,"following"?: number | null,"id"?: string,"media_count"?: number | null,"profile_views"?: number | null,"reach_day"?: number | null,"total_likes"?: number | null,"total_views"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_snapshots_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "social_accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"alert_reads": {
                  Row: {
                    "alert_id": string,"read_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_id": string,"read_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "alert_id"?: string,"read_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_reads_alert_id_fkey"
      columns: ["alert_id"]
isOneToOne: false
      referencedRelation: "alerts"
      referencedColumns: ["id"]
    }
                  ]
                },"alerts": {
                  Row: {
                    "created_at": string,"created_by": string | null,"dedupe_key": string | null,"id": string,"influencer_id": string | null,"payload": NonNullable<Json>,"read_at": string | null,"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"dedupe_key"?: string | null,"id"?: string,"influencer_id"?: string | null,"payload"?: NonNullable<Json>,"read_at"?: string | null,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"dedupe_key"?: string | null,"id"?: string,"influencer_id"?: string | null,"payload"?: NonNullable<Json>,"read_at"?: string | null,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "created_at": string,"created_by": string | null,"key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"assets": {
                  Row: {
                    "created_at": string,"created_by": string | null,"duration_ms": number | null,"file_size_bytes": number | null,"height": number | null,"id": string,"influencer_id": string | null,"kind": Database["public"]['Enums']["asset_kind"],"mime_type": string | null,"qc_checklist": NonNullable<Json>,"qc_status": string,"storage_path": string,"tags": (string)[],"thumbnail_path": string | null,"updated_at": string,"version_tag": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"duration_ms"?: number | null,"file_size_bytes"?: number | null,"height"?: number | null,"id"?: string,"influencer_id"?: string | null,"kind": Database["public"]['Enums']["asset_kind"],"mime_type"?: string | null,"qc_checklist"?: NonNullable<Json>,"qc_status"?: string,"storage_path": string,"tags"?: (string)[],"thumbnail_path"?: string | null,"updated_at"?: string,"version_tag"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"duration_ms"?: number | null,"file_size_bytes"?: number | null,"height"?: number | null,"id"?: string,"influencer_id"?: string | null,"kind"?: Database["public"]['Enums']["asset_kind"],"mime_type"?: string | null,"qc_checklist"?: NonNullable<Json>,"qc_status"?: string,"storage_path"?: string,"tags"?: (string)[],"thumbnail_path"?: string | null,"updated_at"?: string,"version_tag"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "assets_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    }
                  ]
                },"brand_deal_content_items": {
                  Row: {
                    "brand_deal_id": string,"content_item_id": string,"created_at": string,"created_by": string | null,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_deal_id": string,"content_item_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Update: {
                    "brand_deal_id"?: string,"content_item_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "brand_deal_content_items_brand_deal_id_fkey"
      columns: ["brand_deal_id"]
isOneToOne: false
      referencedRelation: "brand_deals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brand_deal_content_items_content_item_id_fkey"
      columns: ["content_item_id"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["id"]
    }
                  ]
                },"brand_deal_files": {
                  Row: {
                    "brand_deal_id": string,"created_at": string,"created_by": string | null,"file_name": string,"file_size_bytes": number | null,"id": string,"mime_type": string | null,"storage_path": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_deal_id": string,"created_at"?: string,"created_by"?: string | null,"file_name": string,"file_size_bytes"?: number | null,"id"?: string,"mime_type"?: string | null,"storage_path": string,"updated_at"?: string
                  }
                  Update: {
                    "brand_deal_id"?: string,"created_at"?: string,"created_by"?: string | null,"file_name"?: string,"file_size_bytes"?: number | null,"id"?: string,"mime_type"?: string | null,"storage_path"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "brand_deal_files_brand_deal_id_fkey"
      columns: ["brand_deal_id"]
isOneToOne: false
      referencedRelation: "brand_deals"
      referencedColumns: ["id"]
    }
                  ]
                },"brand_deals": {
                  Row: {
                    "brand_id": string,"brief": NonNullable<Json>,"created_at": string,"created_by": string | null,"currency": string,"deliverables": NonNullable<Json>,"due_date": string | null,"fee": number | null,"id": string,"influencer_id": string,"notes": string,"paid_at": string | null,"stage": Database["public"]['Enums']["brand_deal_stage"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id": string,"brief"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deliverables"?: NonNullable<Json>,"due_date"?: string | null,"fee"?: number | null,"id"?: string,"influencer_id": string,"notes"?: string,"paid_at"?: string | null,"stage"?: Database["public"]['Enums']["brand_deal_stage"],"updated_at"?: string
                  }
                  Update: {
                    "brand_id"?: string,"brief"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deliverables"?: NonNullable<Json>,"due_date"?: string | null,"fee"?: number | null,"id"?: string,"influencer_id"?: string,"notes"?: string,"paid_at"?: string | null,"stage"?: Database["public"]['Enums']["brand_deal_stage"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "brand_deals_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brand_deals_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    }
                  ]
                },"brands": {
                  Row: {
                    "contact_email": string | null,"contact_name": string | null,"created_at": string,"created_by": string | null,"id": string,"name": string,"notes": string,"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_email"?: string | null,"contact_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"notes"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "contact_email"?: string | null,"contact_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"notes"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"budgets": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"currency": string,"id": string,"influencer_id": string | null,"month": string,"updated_at": string,"warn_ratio": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"influencer_id"?: string | null,"month": string,"updated_at"?: string,"warn_ratio"?: number
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"influencer_id"?: string | null,"month"?: string,"updated_at"?: string,"warn_ratio"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "budgets_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    }
                  ]
                },"comment_replies": {
                  Row: {
                    "attempts": number,"body": string,"comment_id": string,"created_at": string,"created_by": string | null,"error": string | null,"external_id": string | null,"id": string,"next_attempt_at": string,"sent_at": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"body": string,"comment_id": string,"created_at"?: string,"created_by"?: string | null,"error"?: string | null,"external_id"?: string | null,"id"?: string,"next_attempt_at"?: string,"sent_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"body"?: string,"comment_id"?: string,"created_at"?: string,"created_by"?: string | null,"error"?: string | null,"external_id"?: string | null,"id"?: string,"next_attempt_at"?: string,"sent_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comment_replies_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "account_id": string,"author_name": string,"brand_deal_id": string | null,"created_at": string,"created_by": string | null,"external_id": string,"id": string,"is_brand_inquiry": boolean,"like_count": number | null,"parent_external_id": string | null,"platform": Database["public"]['Enums']["social_platform"],"post_id": string,"published_at": string,"replied_at": string | null,"status": string,"text": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"author_name"?: string,"brand_deal_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"external_id": string,"id"?: string,"is_brand_inquiry"?: boolean,"like_count"?: number | null,"parent_external_id"?: string | null,"platform": Database["public"]['Enums']["social_platform"],"post_id": string,"published_at": string,"replied_at"?: string | null,"status"?: string,"text": string,"updated_at"?: string
                  }
                  Update: {
                    "account_id"?: string,"author_name"?: string,"brand_deal_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"external_id"?: string,"id"?: string,"is_brand_inquiry"?: boolean,"like_count"?: number | null,"parent_external_id"?: string | null,"platform"?: Database["public"]['Enums']["social_platform"],"post_id"?: string,"published_at"?: string,"replied_at"?: string | null,"status"?: string,"text"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "social_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_brand_deal_id_fkey"
      columns: ["brand_deal_id"]
isOneToOne: false
      referencedRelation: "brand_deals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"content_item_assets": {
                  Row: {
                    "asset_id": string | null,"content_item_id": string,"created_at": string,"created_by": string | null,"generation_id": string | null,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_id"?: string | null,"content_item_id": string,"created_at"?: string,"created_by"?: string | null,"generation_id"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Update: {
                    "asset_id"?: string | null,"content_item_id"?: string,"created_at"?: string,"created_by"?: string | null,"generation_id"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_item_assets_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_item_assets_content_item_id_fkey"
      columns: ["content_item_id"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_item_assets_generation_id_fkey"
      columns: ["generation_id"]
isOneToOne: false
      referencedRelation: "generations"
      referencedColumns: ["id"]
    }
                  ]
                },"content_items": {
                  Row: {
                    "adaptation_score": number | null,"assignee_id": string | null,"checklist": NonNullable<Json>,"checklist_scored_by": string | null,"created_at": string,"created_by": string | null,"format": string,"hook_type": string | null,"id": string,"influencer_id": string,"notes": string,"scheduled_at": string | null,"sort_order": number,"source_checked_at": string | null,"source_checked_by": string | null,"source_license": string,"source_owner": string,"source_type": Database["public"]['Enums']["content_source_type"] | null,"source_url": string,"source_views": number | null,"stage": Database["public"]['Enums']["content_stage"],"target_account_id": string | null,"timezone": string,"title": string,"updated_at": string,"viral_reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adaptation_score"?: number | null,"assignee_id"?: string | null,"checklist"?: NonNullable<Json>,"checklist_scored_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"format"?: string,"hook_type"?: string | null,"id"?: string,"influencer_id": string,"notes"?: string,"scheduled_at"?: string | null,"sort_order"?: number,"source_checked_at"?: string | null,"source_checked_by"?: string | null,"source_license"?: string,"source_owner"?: string,"source_type"?: Database["public"]['Enums']["content_source_type"] | null,"source_url"?: string,"source_views"?: number | null,"stage"?: Database["public"]['Enums']["content_stage"],"target_account_id"?: string | null,"timezone"?: string,"title": string,"updated_at"?: string,"viral_reason"?: string
                  }
                  Update: {
                    "adaptation_score"?: number | null,"assignee_id"?: string | null,"checklist"?: NonNullable<Json>,"checklist_scored_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"format"?: string,"hook_type"?: string | null,"id"?: string,"influencer_id"?: string,"notes"?: string,"scheduled_at"?: string | null,"sort_order"?: number,"source_checked_at"?: string | null,"source_checked_by"?: string | null,"source_license"?: string,"source_owner"?: string,"source_type"?: Database["public"]['Enums']["content_source_type"] | null,"source_url"?: string,"source_views"?: number | null,"stage"?: Database["public"]['Enums']["content_stage"],"target_account_id"?: string | null,"timezone"?: string,"title"?: string,"updated_at"?: string,"viral_reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_items_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "content_items_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_items_target_account_id_fkey"
      columns: ["target_account_id"]
isOneToOne: false
      referencedRelation: "social_accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"costs": {
                  Row: {
                    "amount": number,"category": Database["public"]['Enums']["cost_category"],"created_at": string,"created_by": string | null,"credits": number | null,"currency": string,"description": string,"generation_id": string | null,"id": string,"incurred_on": string,"influencer_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category": Database["public"]['Enums']["cost_category"],"created_at"?: string,"created_by"?: string | null,"credits"?: number | null,"currency"?: string,"description"?: string,"generation_id"?: string | null,"id"?: string,"incurred_on"?: string,"influencer_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"category"?: Database["public"]['Enums']["cost_category"],"created_at"?: string,"created_by"?: string | null,"credits"?: number | null,"currency"?: string,"description"?: string,"generation_id"?: string | null,"id"?: string,"incurred_on"?: string,"influencer_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "costs_generation_id_fkey"
      columns: ["generation_id"]
isOneToOne: true
      referencedRelation: "generations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "costs_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    }
                  ]
                },"credit_rates": {
                  Row: {
                    "created_at": string,"created_by": string | null,"currency": string,"id": string,"rate_per_credit": number,"tool": string,"updated_at": string,"valid_from": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"currency": string,"id"?: string,"rate_per_credit": number,"tool": string,"updated_at"?: string,"valid_from": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"rate_per_credit"?: number,"tool"?: string,"updated_at"?: string,"valid_from"?: string
                  }
                  Relationships: [
                    
                  ]
                },"exchange_rates": {
                  Row: {
                    "base_currency": string,"created_at": string,"created_by": string | null,"currency": string,"id": string,"rate": number,"updated_at": string,"valid_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_currency": string,"created_at"?: string,"created_by"?: string | null,"currency": string,"id"?: string,"rate": number,"updated_at"?: string,"valid_on": string
                  }
                  Update: {
                    "base_currency"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"rate"?: number,"updated_at"?: string,"valid_on"?: string
                  }
                  Relationships: [
                    
                  ]
                },"generation_worker_status": {
                  Row: {
                    "claimed": number,"id": boolean,"last_run_at": string,"message": string | null,"providers": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimed"?: number,"id"?: boolean,"last_run_at"?: string,"message"?: string | null,"providers"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "claimed"?: number,"id"?: boolean,"last_run_at"?: string,"message"?: string | null,"providers"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"generations": {
                  Row: {
                    "attempts": number,"cancel_requested_at": string | null,"created_at": string,"created_by": string | null,"credits": number | null,"duration_ms": number | null,"error": string | null,"finished_at": string | null,"id": string,"influencer_id": string,"input_asset_ids": (string)[],"max_attempts": number,"mode": string,"next_run_at": string,"output_asset_id": string | null,"params": NonNullable<Json>,"progress": number,"prompt_id": string | null,"provider_job_id": string | null,"retry_of": string | null,"started_at": string | null,"status": Database["public"]['Enums']["generation_status"],"tool": string,"type": Database["public"]['Enums']["generation_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"cancel_requested_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"credits"?: number | null,"duration_ms"?: number | null,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"influencer_id": string,"input_asset_ids"?: (string)[],"max_attempts"?: number,"mode": string,"next_run_at"?: string,"output_asset_id"?: string | null,"params"?: NonNullable<Json>,"progress"?: number,"prompt_id"?: string | null,"provider_job_id"?: string | null,"retry_of"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["generation_status"],"tool": string,"type": Database["public"]['Enums']["generation_type"],"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"cancel_requested_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"credits"?: number | null,"duration_ms"?: number | null,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"influencer_id"?: string,"input_asset_ids"?: (string)[],"max_attempts"?: number,"mode"?: string,"next_run_at"?: string,"output_asset_id"?: string | null,"params"?: NonNullable<Json>,"progress"?: number,"prompt_id"?: string | null,"provider_job_id"?: string | null,"retry_of"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["generation_status"],"tool"?: string,"type"?: Database["public"]['Enums']["generation_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "generations_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "generations_output_asset_id_fkey"
      columns: ["output_asset_id"]
isOneToOne: false
      referencedRelation: "assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "generations_prompt_id_fkey"
      columns: ["prompt_id"]
isOneToOne: false
      referencedRelation: "prompt_lineages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "generations_prompt_id_fkey"
      columns: ["prompt_id"]
isOneToOne: false
      referencedRelation: "prompt_stats"
      referencedColumns: ["prompt_id"]
    },{
      foreignKeyName: "generations_prompt_id_fkey"
      columns: ["prompt_id"]
isOneToOne: false
      referencedRelation: "prompts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "generations_retry_of_fkey"
      columns: ["retry_of"]
isOneToOne: false
      referencedRelation: "generations"
      referencedColumns: ["id"]
    }
                  ]
                },"influencer_personas": {
                  Row: {
                    "appearance": NonNullable<Json>,"audience": NonNullable<Json>,"bio": string,"change_note": string,"created_at": string,"created_by": string | null,"hook_traits": (string)[],"id": string,"influencer_id": string,"is_current": boolean,"personality": NonNullable<Json>,"restored_from_version": number | null,"sample_captions": (string)[],"tone": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "appearance"?: NonNullable<Json>,"audience"?: NonNullable<Json>,"bio"?: string,"change_note"?: string,"created_at"?: string,"created_by"?: string | null,"hook_traits"?: (string)[],"id"?: string,"influencer_id": string,"is_current"?: boolean,"personality"?: NonNullable<Json>,"restored_from_version"?: number | null,"sample_captions"?: (string)[],"tone"?: string,"updated_at"?: string,"version": number
                  }
                  Update: {
                    "appearance"?: NonNullable<Json>,"audience"?: NonNullable<Json>,"bio"?: string,"change_note"?: string,"created_at"?: string,"created_by"?: string | null,"hook_traits"?: (string)[],"id"?: string,"influencer_id"?: string,"is_current"?: boolean,"personality"?: NonNullable<Json>,"restored_from_version"?: number | null,"sample_captions"?: (string)[],"tone"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "influencer_personas_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    }
                  ]
                },"influencers": {
                  Row: {
                    "avatar_asset_id": string | null,"created_at": string,"created_by": string | null,"id": string,"language": string,"name": string,"niche": string | null,"slug": string,"status": Database["public"]['Enums']["influencer_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_asset_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"language"?: string,"name": string,"niche"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["influencer_status"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_asset_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"language"?: string,"name"?: string,"niche"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["influencer_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "influencers_avatar_asset_id_fkey"
      columns: ["avatar_asset_id"]
isOneToOne: false
      referencedRelation: "assets"
      referencedColumns: ["id"]
    }
                  ]
                },"learnings": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string | null,"id": string,"influencer_id": string | null,"post_id": string | null,"tags": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"influencer_id"?: string | null,"post_id"?: string | null,"tags"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"influencer_id"?: string | null,"post_id"?: string | null,"tags"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "learnings_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learnings_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"metric_snapshots": {
                  Row: {
                    "avg_watch_time_s": number | null,"captured_at": string,"comments": number,"completion_rate": number | null,"created_at": string,"created_by": string | null,"hours_since_publish": number | null,"id": string,"likes": number,"post_id": string,"raw_payload": NonNullable<Json>,"reach": number | null,"saves": number,"shares": number,"source": string,"target_hours": number | null,"updated_at": string,"views": number
                  }
                  ComputedFields: never
                  Insert: {
                    "avg_watch_time_s"?: number | null,"captured_at"?: string,"comments"?: number,"completion_rate"?: number | null,"created_at"?: string,"created_by"?: string | null,"hours_since_publish"?: number | null,"id"?: string,"likes"?: number,"post_id": string,"raw_payload"?: NonNullable<Json>,"reach"?: number | null,"saves"?: number,"shares"?: number,"source"?: string,"target_hours"?: number | null,"updated_at"?: string,"views"?: number
                  }
                  Update: {
                    "avg_watch_time_s"?: number | null,"captured_at"?: string,"comments"?: number,"completion_rate"?: number | null,"created_at"?: string,"created_by"?: string | null,"hours_since_publish"?: number | null,"id"?: string,"likes"?: number,"post_id"?: string,"raw_payload"?: NonNullable<Json>,"reach"?: number | null,"saves"?: number,"shares"?: number,"source"?: string,"target_hours"?: number | null,"updated_at"?: string,"views"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "metric_snapshots_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_settings": {
                  Row: {
                    "created_at": string,"created_by": string | null,"follower_milestones": (number)[],"id": boolean,"push_email": boolean,"push_ntfy": boolean,"push_telegram": boolean,"token_expiry_days": number,"updated_at": string,"viral_multiplier": number,"youtube_quota_warn_units": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"follower_milestones"?: (number)[],"id"?: boolean,"push_email"?: boolean,"push_ntfy"?: boolean,"push_telegram"?: boolean,"token_expiry_days"?: number,"updated_at"?: string,"viral_multiplier"?: number,"youtube_quota_warn_units"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"follower_milestones"?: (number)[],"id"?: boolean,"push_email"?: boolean,"push_ntfy"?: boolean,"push_telegram"?: boolean,"token_expiry_days"?: number,"updated_at"?: string,"viral_multiplier"?: number,"youtube_quota_warn_units"?: number
                  }
                  Relationships: [
                    
                  ]
                },"posting_slots": {
                  Row: {
                    "account_id": string,"created_at": string,"created_by": string | null,"id": string,"local_time": string,"timezone": string,"updated_at": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"local_time": string,"timezone"?: string,"updated_at"?: string,"weekday": number
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"local_time"?: string,"timezone"?: string,"updated_at"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "posting_slots_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "social_accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "account_id": string,"caption": string,"content_item_id": string | null,"created_at": string,"created_by": string | null,"duration_s": number | null,"external_id": string | null,"id": string,"is_short": boolean,"published_at": string | null,"updated_at": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"caption"?: string,"content_item_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"duration_s"?: number | null,"external_id"?: string | null,"id"?: string,"is_short"?: boolean,"published_at"?: string | null,"updated_at"?: string,"url"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"caption"?: string,"content_item_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"duration_s"?: number | null,"external_id"?: string | null,"id"?: string,"is_short"?: boolean,"published_at"?: string | null,"updated_at"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "social_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_content_item_id_fkey"
      columns: ["content_item_id"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["id"]
    }
                  ]
                },"prompts": {
                  Row: {
                    "body": string,"category": Database["public"]['Enums']["prompt_category"],"change_note": string,"created_at": string,"created_by": string | null,"id": string,"influencer_id": string | null,"key": string,"negative": string,"rating": number | null,"title": string,"updated_at": string,"variables": NonNullable<Json>,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"category": Database["public"]['Enums']["prompt_category"],"change_note"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"influencer_id"?: string | null,"key"?: string,"negative"?: string,"rating"?: number | null,"title"?: string,"updated_at"?: string,"variables"?: NonNullable<Json>,"version"?: number
                  }
                  Update: {
                    "body"?: string,"category"?: Database["public"]['Enums']["prompt_category"],"change_note"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"influencer_id"?: string | null,"key"?: string,"negative"?: string,"rating"?: number | null,"title"?: string,"updated_at"?: string,"variables"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "prompts_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    }
                  ]
                },"publish_jobs": {
                  Row: {
                    "account_id": string,"asset_id": string | null,"attempts": number,"caption": string,"container_created_at": string | null,"content_item_id": string,"created_at": string,"created_by": string | null,"error": string | null,"external_id": string | null,"finished_at": string | null,"id": string,"max_attempts": number,"next_attempt_at": string,"paid_partnership": boolean,"platform": Database["public"]['Enums']["social_platform"],"provider_container_id": string | null,"provider_upload_url": string | null,"published_post_id": string | null,"scheduled_for": string,"started_at": string | null,"status": Database["public"]['Enums']["publish_job_status"],"tags": (string)[],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"asset_id"?: string | null,"attempts"?: number,"caption"?: string,"container_created_at"?: string | null,"content_item_id": string,"created_at"?: string,"created_by"?: string | null,"error"?: string | null,"external_id"?: string | null,"finished_at"?: string | null,"id"?: string,"max_attempts"?: number,"next_attempt_at"?: string,"paid_partnership"?: boolean,"platform": Database["public"]['Enums']["social_platform"],"provider_container_id"?: string | null,"provider_upload_url"?: string | null,"published_post_id"?: string | null,"scheduled_for"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["publish_job_status"],"tags"?: (string)[],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "account_id"?: string,"asset_id"?: string | null,"attempts"?: number,"caption"?: string,"container_created_at"?: string | null,"content_item_id"?: string,"created_at"?: string,"created_by"?: string | null,"error"?: string | null,"external_id"?: string | null,"finished_at"?: string | null,"id"?: string,"max_attempts"?: number,"next_attempt_at"?: string,"paid_partnership"?: boolean,"platform"?: Database["public"]['Enums']["social_platform"],"provider_container_id"?: string | null,"provider_upload_url"?: string | null,"published_post_id"?: string | null,"scheduled_for"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["publish_job_status"],"tags"?: (string)[],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "publish_jobs_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "social_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "publish_jobs_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "publish_jobs_content_item_id_fkey"
      columns: ["content_item_id"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "publish_jobs_published_post_id_fkey"
      columns: ["published_post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "ai_summary": string | null,"created_at": string,"created_by": string | null,"id": string,"influencer_id": string | null,"period_end": string,"period_start": string,"summary": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_summary"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"influencer_id"?: string | null,"period_end": string,"period_start": string,"summary": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "ai_summary"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"influencer_id"?: string | null,"period_end"?: string,"period_start"?: string,"summary"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    }
                  ]
                },"social_accounts": {
                  Row: {
                    "created_at": string,"created_by": string | null,"external_id": string | null,"handle": string,"id": string,"influencer_id": string,"platform": Database["public"]['Enums']["social_platform"],"status": Database["public"]['Enums']["social_account_status"],"token_expires_at": string | null,"token_ref": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"external_id"?: string | null,"handle": string,"id"?: string,"influencer_id": string,"platform": Database["public"]['Enums']["social_platform"],"status"?: Database["public"]['Enums']["social_account_status"],"token_expires_at"?: string | null,"token_ref"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"external_id"?: string | null,"handle"?: string,"id"?: string,"influencer_id"?: string,"platform"?: Database["public"]['Enums']["social_platform"],"status"?: Database["public"]['Enums']["social_account_status"],"token_expires_at"?: string | null,"token_ref"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "social_accounts_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    }
                  ]
                },"sync_runs": {
                  Row: {
                    "account_id": string | null,"created_at": string,"created_by": string | null,"error": string | null,"finished_at": string | null,"id": string,"job": string,"platform": Database["public"]['Enums']["social_platform"] | null,"processed_count": number,"quota_units": number | null,"started_at": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"job": string,"platform"?: Database["public"]['Enums']["social_platform"] | null,"processed_count"?: number,"quota_units"?: number | null,"started_at"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "account_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"job"?: string,"platform"?: Database["public"]['Enums']["social_platform"] | null,"processed_count"?: number,"quota_units"?: number | null,"started_at"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sync_runs_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "social_accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"team_members": {
                  Row: {
                    "created_at": string,"created_by": string | null,"role": Database["public"]['Enums']["team_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"role": Database["public"]['Enums']["team_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"role"?: Database["public"]['Enums']["team_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"trends": {
                  Row: {
                    "account_handle": string,"adaptation_idea": string,"adaptation_score": number | null,"captured_on": string,"comments": number | null,"content_item_id": string | null,"cost_estimate": string | null,"created_at": string,"created_by": string | null,"duration_s": number | null,"format": string,"hook": string,"id": string,"influencer_id": string | null,"likes": number | null,"notes": string,"platform": string,"sound": string,"source": string,"status": string,"updated_at": string,"url": string,"views": number | null,"why_viral": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_handle"?: string,"adaptation_idea"?: string,"adaptation_score"?: number | null,"captured_on"?: string,"comments"?: number | null,"content_item_id"?: string | null,"cost_estimate"?: string | null,"created_at"?: string,"created_by"?: string | null,"duration_s"?: number | null,"format"?: string,"hook"?: string,"id"?: string,"influencer_id"?: string | null,"likes"?: number | null,"notes"?: string,"platform"?: string,"sound"?: string,"source"?: string,"status"?: string,"updated_at"?: string,"url": string,"views"?: number | null,"why_viral"?: string
                  }
                  Update: {
                    "account_handle"?: string,"adaptation_idea"?: string,"adaptation_score"?: number | null,"captured_on"?: string,"comments"?: number | null,"content_item_id"?: string | null,"cost_estimate"?: string | null,"created_at"?: string,"created_by"?: string | null,"duration_s"?: number | null,"format"?: string,"hook"?: string,"id"?: string,"influencer_id"?: string | null,"likes"?: number | null,"notes"?: string,"platform"?: string,"sound"?: string,"source"?: string,"status"?: string,"updated_at"?: string,"url"?: string,"views"?: number | null,"why_viral"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trends_content_item_id_fkey"
      columns: ["content_item_id"]
isOneToOne: false
      referencedRelation: "content_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trends_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "prompt_lineages": {
                  Row: {
                    "body": string | null,"category": Database["public"]['Enums']["prompt_category"] | null,"change_note": string | null,"created_at": string | null,"created_by": string | null,"id": string | null,"influencer_id": string | null,"key": string | null,"negative": string | null,"rating": number | null,"title": string | null,"updated_at": string | null,"variables": Json | null,"version": number | null,"version_count": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "prompts_influencer_id_fkey"
      columns: ["influencer_id"]
isOneToOne: false
      referencedRelation: "influencers"
      referencedColumns: ["id"]
    }
                  ]
                },"prompt_stats": {
                  Row: {
                    "avg_credits": number | null,"failed": number | null,"pending": number | null,"prompt_id": string | null,"succeeded": number | null,"success_rate": number | null,"total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "ai_weekly_summary":
{ Args: { "p_as_of"?: string,"p_influencer_id": string }; Returns: Json
                           },
"asset_object_in_influencer_folder":
{ Args: { "object_name": string }; Returns: boolean
                           },
"brand_deal_revenue":
{ Args: { "p_currency": string,"p_from": string,"p_influencer_id"?: string,"p_to": string }; Returns: {
              "converted_fee": number,"currency": string,"fee": number,"id": string,"influencer_id": string,"paid_at": string
            }[]
                           },
"brand_file_in_deal_folder":
{ Args: { "object_name": string }; Returns: boolean
                           },
"budget_status":
{ Args: { "p_month": string }; Returns: {
              "amount": number,"budget_id": string,"currency": string,"influencer_id": string,"missing_rate_count": number,"month": string,"ratio": number,"spent": number,"warn_ratio": number
            }[]
                           },
"can_manage_team":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_write_data":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"cancel_generation":
{ Args: { "p_id": string }; Returns: {
              "attempts": number,
"cancel_requested_at": string | null,
"created_at": string,
"created_by": string | null,
"credits": number | null,
"duration_ms": number | null,
"error": string | null,
"finished_at": string | null,
"id": string,
"influencer_id": string,
"input_asset_ids": (string)[],
"max_attempts": number,
"mode": string,
"next_run_at": string,
"output_asset_id": string | null,
"params": NonNullable<Json>,
"progress": number,
"prompt_id": string | null,
"provider_job_id": string | null,
"retry_of": string | null,
"started_at": string | null,
"status": Database["public"]['Enums']["generation_status"],
"tool": string,
"type": Database["public"]['Enums']["generation_type"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "generations"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_publish_job":
{ Args: { "p_id": string }; Returns: string
                           },
"claim_generations":
{ Args: { "p_lease_seconds"?: number,"p_limit"?: number,"p_tools": (string)[] }; Returns: {
              "attempts": number,
"cancel_requested_at": string | null,
"created_at": string,
"created_by": string | null,
"credits": number | null,
"duration_ms": number | null,
"error": string | null,
"finished_at": string | null,
"id": string,
"influencer_id": string,
"input_asset_ids": (string)[],
"max_attempts": number,
"mode": string,
"next_run_at": string,
"output_asset_id": string | null,
"params": NonNullable<Json>,
"progress": number,
"prompt_id": string | null,
"provider_job_id": string | null,
"retry_of": string | null,
"started_at": string | null,
"status": Database["public"]['Enums']["generation_status"],
"tool": string,
"type": Database["public"]['Enums']["generation_type"],
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "generations"
        isOneToOne: false
        isSetofReturn: true
      } },
"claim_publish_jobs":
{ Args: { "p_lease_seconds"?: number,"p_limit"?: number }; Returns: {
              "account_id": string,
"asset_id": string | null,
"attempts": number,
"caption": string,
"container_created_at": string | null,
"content_item_id": string,
"created_at": string,
"created_by": string | null,
"error": string | null,
"external_id": string | null,
"finished_at": string | null,
"id": string,
"max_attempts": number,
"next_attempt_at": string,
"paid_partnership": boolean,
"platform": Database["public"]['Enums']["social_platform"],
"provider_container_id": string | null,
"provider_upload_url": string | null,
"published_post_id": string | null,
"scheduled_for": string,
"started_at": string | null,
"status": Database["public"]['Enums']["publish_job_status"],
"tags": (string)[],
"title": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "publish_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"complete_generation":
{ Args: { "p_credits"?: number,"p_file_size_bytes"?: number,"p_id": string,"p_mime_type": string,"p_storage_path": string }; Returns: {
              "attempts": number,
"cancel_requested_at": string | null,
"created_at": string,
"created_by": string | null,
"credits": number | null,
"duration_ms": number | null,
"error": string | null,
"finished_at": string | null,
"id": string,
"influencer_id": string,
"input_asset_ids": (string)[],
"max_attempts": number,
"mode": string,
"next_run_at": string,
"output_asset_id": string | null,
"params": NonNullable<Json>,
"progress": number,
"prompt_id": string | null,
"provider_job_id": string | null,
"retry_of": string | null,
"started_at": string | null,
"status": Database["public"]['Enums']["generation_status"],
"tool": string,
"type": Database["public"]['Enums']["generation_type"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "generations"
        isOneToOne: true
        isSetofReturn: false
      } },
"complete_publish_job":
{ Args: { "p_duration_s"?: number,"p_external_id": string,"p_id": string,"p_is_short"?: boolean,"p_published_at": string,"p_url": string }; Returns: string
                           },
"content_checklist_ready":
{ Args: { "p_checklist": Json }; Returns: boolean
                           },
"content_is_v2v":
{ Args: { "p_id": string }; Returns: boolean
                           },
"content_item_details":
{ Args: { "p_ids": (string)[] }; Returns: Json
                           },
"content_schedule_warnings":
{ Args: { "p_id": string }; Returns: (string)[]
                           },
"content_source_missing_ids":
{ Args: { "p_influencer_id"?: string }; Returns: (string)[]
                           },
"cost_by_category":
{ Args: { "p_currency": string,"p_from": string,"p_influencer_id"?: string,"p_to": string }; Returns: {
              "category": Database["public"]['Enums']["cost_category"],"missing_rate_count": number,"total": number
            }[]
                           },
"cost_daily":
{ Args: { "p_currency": string,"p_from": string,"p_influencer_id"?: string,"p_to": string }; Returns: {
              "day": string,"missing_rate_count": number,"total": number
            }[]
                           },
"cost_entries_converted":
{ Args: { "p_currency": string,"p_from": string,"p_influencer_id"?: string,"p_to": string }; Returns: {
              "amount": number,"category": Database["public"]['Enums']["cost_category"],"converted_amount": number,"currency": string,"generation_id": string,"id": string,"incurred_on": string,"influencer_id": string
            }[]
                           },
"cost_summary":
{ Args: { "p_currency": string,"p_from": string,"p_influencer_id"?: string,"p_to": string }; Returns: {
              "cost_per_1000_views": number,"cost_per_video": number,"entry_count": number,"failed_cost": number,"failed_credits": number,"failed_generation_count": number,"failed_ratio": number,"generation_count": number,"missing_rate_count": number,"total": number,"video_count": number,"views": number
            }[]
                           },
"create_persona_version":
{ Args: { "p_appearance": Json,"p_audience": Json,"p_bio": string,"p_change_note"?: string,"p_hook_traits": (string)[],"p_influencer_id": string,"p_personality": Json,"p_restored_from_version"?: number,"p_sample_captions"?: (string)[],"p_tone": string }; Returns: {
              "appearance": NonNullable<Json>,
"audience": NonNullable<Json>,
"bio": string,
"change_note": string,
"created_at": string,
"created_by": string | null,
"hook_traits": (string)[],
"id": string,
"influencer_id": string,
"is_current": boolean,
"personality": NonNullable<Json>,
"restored_from_version": number | null,
"sample_captions": (string)[],
"tone": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "influencer_personas"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_prompt_version":
{ Args: { "p_body": string,"p_category": Database["public"]['Enums']["prompt_category"],"p_change_note"?: string,"p_influencer_id"?: string,"p_key": string,"p_negative"?: string,"p_title": string,"p_variables"?: Json }; Returns: {
              "body": string,
"category": Database["public"]['Enums']["prompt_category"],
"change_note": string,
"created_at": string,
"created_by": string | null,
"id": string,
"influencer_id": string | null,
"key": string,
"negative": string,
"rating": number | null,
"title": string,
"updated_at": string,
"variables": NonNullable<Json>,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "prompts"
        isOneToOne: true
        isSetofReturn: false
      } },
"credits_to_money":
{ Args: { "p_credits": number,"p_on": string,"p_tool": string }; Returns: {
              "amount": number,"currency": string
            }[]
                           },
"current_team_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["team_role"]
                           },
"dashboard_overview":
{ Args: { "p_from": string,"p_influencer_slug"?: string,"p_platform"?: Database["public"]['Enums']["social_platform"],"p_to": string }; Returns: Json
                           },
"delete_social_token":
{ Args: { "p_account_id": string }; Returns: undefined
                           },
"due_snapshots":
{ Args: { "p_account_id"?: string,"p_at": string,"p_limit"?: number }; Returns: {
              "account_id": string,"due_at": string,"external_id": string,"platform": Database["public"]['Enums']["social_platform"],"post_id": string,"published_at": string,"target_hours": number
            }[]
                           },
"enqueue_generation":
{ Args: { "p_influencer_id": string,"p_input_asset_ids"?: (string)[],"p_mode"?: string,"p_override_budget"?: boolean,"p_params"?: Json,"p_prompt_id"?: string,"p_retry_of"?: string,"p_tool": string,"p_type": Database["public"]['Enums']["generation_type"] }; Returns: {
              "attempts": number,
"cancel_requested_at": string | null,
"created_at": string,
"created_by": string | null,
"credits": number | null,
"duration_ms": number | null,
"error": string | null,
"finished_at": string | null,
"id": string,
"influencer_id": string,
"input_asset_ids": (string)[],
"max_attempts": number,
"mode": string,
"next_run_at": string,
"output_asset_id": string | null,
"params": NonNullable<Json>,
"progress": number,
"prompt_id": string | null,
"provider_job_id": string | null,
"retry_of": string | null,
"started_at": string | null,
"status": Database["public"]['Enums']["generation_status"],
"tool": string,
"type": Database["public"]['Enums']["generation_type"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "generations"
        isOneToOne: true
        isSetofReturn: false
      } },
"enqueue_publish_job":
{ Args: { "p_caption"?: string,"p_content_id": string,"p_scheduled_for"?: string,"p_tags"?: (string)[],"p_title": string }; Returns: string
                           },
"fx_rate":
{ Args: { "p_from": string,"p_on": string,"p_to": string }; Returns: number
                           },
"generate_weekly_report":
{ Args: { "p_influencer_id"?: string,"p_period_start": string }; Returns: string
                           },
"generate_weekly_reports":
{ Args: { "p_period_start"?: string }; Returns: number
                           },
"influencer_list_stats":
{ Args: { "p_influencer_ids"?: (string)[],"p_since"?: string }; Returns: {
              "followers": number,"influencer_id": string,"platforms": (string)[],"views_7d": number
            }[]
                           },
"is_initial_owner_setup":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_team_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"link_content_post":
{ Args: { "p_content_id": string,"p_post_id": string }; Returns: {
              "adaptation_score": number | null,
"assignee_id": string | null,
"checklist": NonNullable<Json>,
"checklist_scored_by": string | null,
"created_at": string,
"created_by": string | null,
"format": string,
"hook_type": string | null,
"id": string,
"influencer_id": string,
"notes": string,
"scheduled_at": string | null,
"sort_order": number,
"source_checked_at": string | null,
"source_checked_by": string | null,
"source_license": string,
"source_owner": string,
"source_type": Database["public"]['Enums']["content_source_type"] | null,
"source_url": string,
"source_views": number | null,
"stage": Database["public"]['Enums']["content_stage"],
"target_account_id": string | null,
"timezone": string,
"title": string,
"updated_at": string,
"viral_reason": string
            }
                          SetofOptions: {
        from: "*"
        to: "content_items"
        isOneToOne: true
        isSetofReturn: false
      } },
"mark_alerts_read":
{ Args: { "p_alert_ids"?: (string)[] }; Returns: number
                           },
"oauth_connect_token":
{ Args: { "p_account_id": string,"p_expires_at": string,"p_external_id": string,"p_influencer_id": string,"p_platform": Database["public"]['Enums']["social_platform"],"p_token": Json,"p_user_id": string }; Returns: undefined
                           },
"oauth_refresh_claim":
{ Args: { "p_platforms": (Database["public"]['Enums']["social_platform"])[] }; Returns: Json
                           },
"oauth_refresh_finish":
{ Args: { "p_account_id": string,"p_expires_at": string,"p_lease_id": string,"p_result": string,"p_token": Json }; Returns: boolean
                           },
"oauth_revoke_begin":
{ Args: { "p_account_id": string,"p_influencer_id": string,"p_user_id": string }; Returns: Json
                           },
"oauth_revoke_finish":
{ Args: { "p_account_id": string,"p_nonce": string }; Returns: boolean
                           },
"oauth_state_consume":
{ Args: { "p_hash": string,"p_influencer_id": string,"p_platform": Database["public"]['Enums']["social_platform"],"p_user_id": string }; Returns: Json
                           },
"oauth_state_save":
{ Args: { "p_expires_at": string,"p_hash": string,"p_influencer_id": string,"p_platform": Database["public"]['Enums']["social_platform"],"p_user_id": string,"p_verifier": string }; Returns: undefined
                           },
"post_analytics":
{ Args: { "p_baseline_posts"?: number,"p_post_id": string }; Returns: Json
                           },
"post_checkpoint_views":
{ Args: { "p_post_ids": (string)[] }; Returns: {
              "hours": number,"post_id": string,"target_hours": number,"views": number
            }[]
                           },
"post_cost":
{ Args: { "p_currency": string,"p_post_id": string }; Returns: {
              "allocation": string,"currency": string,"entry_count": number,"generation_count": number,"missing_rate_count": number,"post_id": string,"total": number
            }[]
                           },
"post_segments":
{ Args: { "p_influencer_slug"?: string,"p_target_hours"?: number }; Returns: Json
                           },
"push_trend_to_backlog":
{ Args: { "p_influencer_id"?: string,"p_title"?: string,"p_trend_id": string }; Returns: string
                           },
"raise_budget_alerts":
{ Args: { "p_month": string }; Returns: number
                           },
"read_social_token":
{ Args: { "p_account_id": string }; Returns: Json
                           },
"record_manual_metrics":
{ Args: { "p_avg_watch_time_s"?: number,"p_comments": number,"p_completion_rate"?: number,"p_likes": number,"p_post_id": string,"p_reach"?: number,"p_saves"?: number,"p_shares": number,"p_target_hours"?: number,"p_views": number }; Returns: Json
                           },
"report_summary":
{ Args: { "p_currency"?: string,"p_from": string,"p_influencer_id"?: string,"p_to": string }; Returns: Json
                           },
"request_sync":
{ Args: { "p_account_id"?: string }; Returns: string
                           },
"restore_persona_version":
{ Args: { "p_change_note"?: string,"p_influencer_id": string,"p_version": number }; Returns: {
              "appearance": NonNullable<Json>,
"audience": NonNullable<Json>,
"bio": string,
"change_note": string,
"created_at": string,
"created_by": string | null,
"hook_traits": (string)[],
"id": string,
"influencer_id": string,
"is_current": boolean,
"personality": NonNullable<Json>,
"restored_from_version": number | null,
"sample_captions": (string)[],
"tone": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "influencer_personas"
        isOneToOne: true
        isSetofReturn: false
      } },
"retry_generation":
{ Args: { "p_id": string,"p_override_budget"?: boolean }; Returns: {
              "attempts": number,
"cancel_requested_at": string | null,
"created_at": string,
"created_by": string | null,
"credits": number | null,
"duration_ms": number | null,
"error": string | null,
"finished_at": string | null,
"id": string,
"influencer_id": string,
"input_asset_ids": (string)[],
"max_attempts": number,
"mode": string,
"next_run_at": string,
"output_asset_id": string | null,
"params": NonNullable<Json>,
"progress": number,
"prompt_id": string | null,
"provider_job_id": string | null,
"retry_of": string | null,
"started_at": string | null,
"status": Database["public"]['Enums']["generation_status"],
"tool": string,
"type": Database["public"]['Enums']["generation_type"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "generations"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_content_item":
{ Args: { "p_asset_ids"?: (string)[],"p_expected_updated_at"?: string,"p_generation_ids"?: (string)[],"p_id": string,"p_values": Json }; Returns: {
              "adaptation_score": number | null,
"assignee_id": string | null,
"checklist": NonNullable<Json>,
"checklist_scored_by": string | null,
"created_at": string,
"created_by": string | null,
"format": string,
"hook_type": string | null,
"id": string,
"influencer_id": string,
"notes": string,
"scheduled_at": string | null,
"sort_order": number,
"source_checked_at": string | null,
"source_checked_by": string | null,
"source_license": string,
"source_owner": string,
"source_type": Database["public"]['Enums']["content_source_type"] | null,
"source_url": string,
"source_views": number | null,
"stage": Database["public"]['Enums']["content_stage"],
"target_account_id": string | null,
"timezone": string,
"title": string,
"updated_at": string,
"viral_reason": string
            }
                          SetofOptions: {
        from: "*"
        to: "content_items"
        isOneToOne: true
        isSetofReturn: false
      } },
"store_social_token":
{ Args: { "p_account_id": string,"p_expires_at"?: string,"p_token": Json }; Returns: string
                           },
"unread_alert_count":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"valid_sample_captions":
{ Args: { "p_values": (string)[] }; Returns: boolean
                           }
          }
          Enums: {
            "asset_kind": "reference"|"generated"|"final_video"|"thumbnail","brand_deal_stage": "lead"|"negotiation"|"signed"|"delivered"|"paid"|"lost","content_source_type": "own"|"stock"|"open_license"|"third_party","content_stage": "idea"|"script"|"production"|"qc"|"edit"|"scheduled"|"published","cost_category": "subscription"|"credits"|"tool"|"other"|"ai_api","generation_status": "queued"|"running"|"succeeded"|"failed"|"cancelled","generation_type": "image"|"video","influencer_status": "draft"|"active"|"paused"|"archived","prompt_category": "character"|"video2video"|"short_film"|"caption"|"research","publish_job_status": "queued"|"processing"|"published"|"failed"|"manual_required"|"cancelled","social_account_status": "pending"|"active"|"expired"|"revoked"|"error","social_platform": "instagram"|"youtube"|"tiktok","team_role": "owner"|"editor"|"viewer"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "asset_kind": ["reference", "generated", "final_video", "thumbnail"],"brand_deal_stage": ["lead", "negotiation", "signed", "delivered", "paid", "lost"],"content_source_type": ["own", "stock", "open_license", "third_party"],"content_stage": ["idea", "script", "production", "qc", "edit", "scheduled", "published"],"cost_category": ["subscription", "credits", "tool", "other", "ai_api"],"generation_status": ["queued", "running", "succeeded", "failed", "cancelled"],"generation_type": ["image", "video"],"influencer_status": ["draft", "active", "paused", "archived"],"prompt_category": ["character", "video2video", "short_film", "caption", "research"],"publish_job_status": ["queued", "processing", "published", "failed", "manual_required", "cancelled"],"social_account_status": ["pending", "active", "expired", "revoked", "error"],"social_platform": ["instagram", "youtube", "tiktok"],"team_role": ["owner", "editor", "viewer"]
          }
        }
} as const
