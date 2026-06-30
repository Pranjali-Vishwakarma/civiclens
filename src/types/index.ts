export type IssueCategory = 'pothole' | 'streetlight' | 'water' | 'garbage' | 'road_damage' | 'other';
export type IssueStatus = 'open' | 'in_progress' | 'resolved';

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  severity: 1 | 2 | 3 | 4 | 5;
  status: IssueStatus;
  lat: number;
  lng: number;
  photo_urls: string[];
  upvotes: number;
  reporter_id: string;
  ward_name: string;
  ai_confidence: number;
  suggested_department: string;
  created_at: string;
  resolved_at?: string;
  verified_at?: string;
  cluster_id?: string;
}
