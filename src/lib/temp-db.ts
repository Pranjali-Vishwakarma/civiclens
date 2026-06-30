import fs from 'fs';
import path from 'path';
import { Issue } from '@/types';

const filePath = path.join(process.cwd(), 'issues-db.json');

export function getLocalIssues(): Issue[] {
  try {
    if (!fs.existsSync(filePath)) {
      // Seed with some sample data if file doesn't exist
      const seedData: Issue[] = [
        {
          id: '1',
          title: 'Deep pothole on Oak Avenue',
          description: 'A massive pothole in the middle lane, forcing cars to swerve dangerously.',
          category: 'pothole',
          severity: 4,
          status: 'open',
          lat: 37.7749,
          lng: -122.4194,
          photo_urls: [],
          upvotes: 12,
          reporter_id: 'citizen-101',
          ward_name: 'Ward 3 - Oak Heights',
          ai_confidence: 0.95,
          suggested_department: 'Department of Transportation',
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          title: 'Flickering street lamp near high school',
          description: 'Streetlight is flickering rapidly, causing poor visibility at night.',
          category: 'streetlight',
          severity: 2,
          status: 'in_progress',
          lat: 37.7833,
          lng: -122.4167,
          photo_urls: [],
          upvotes: 5,
          reporter_id: 'citizen-202',
          ward_name: 'Ward 5 - Mission District',
          ai_confidence: 0.88,
          suggested_department: 'Public Works (Street & Lighting)',
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '3',
          title: 'Burst pipe flooding sidewalk',
          description: 'Water has been flowing continuously from a broken main valve for 3 hours.',
          category: 'water',
          severity: 5,
          status: 'open',
          lat: 37.7699,
          lng: -122.4468,
          photo_urls: [],
          upvotes: 24,
          reporter_id: 'citizen-303',
          ward_name: 'Ward 8 - Castro Valley',
          ai_confidence: 0.98,
          suggested_department: 'Water & Sewer Authority',
          created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
        }
      ];
      fs.writeFileSync(filePath, JSON.stringify(seedData, null, 2));
      return seedData;
    }
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading local issues DB:', error);
    return [];
  }
}

export function saveLocalIssue(issue: Issue): Issue {
  const issues = getLocalIssues();
  issues.unshift(issue); // add to top
  fs.writeFileSync(filePath, JSON.stringify(issues, null, 2));
  return issue;
}

export function updateLocalIssue(id: string, updates: Partial<Issue>): Issue | null {
  const issues = getLocalIssues();
  const idx = issues.findIndex(i => i.id === id);
  if (idx === -1) return null;

  issues[idx] = { ...issues[idx], ...updates };
  fs.writeFileSync(filePath, JSON.stringify(issues, null, 2));
  return issues[idx];
}

const verificationsPath = path.join(process.cwd(), 'verifications-db.json');

export interface LocalVerification {
  id: string;
  issue_id: string;
  user_id: string;
  verdict: 'confirm' | 'dispute';
  note?: string;
  created_at: string;
}

export function getLocalVerifications(): LocalVerification[] {
  try {
    if (!fs.existsSync(verificationsPath)) {
      return [];
    }
    const fileContent = fs.readFileSync(verificationsPath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading local verifications DB:', error);
    return [];
  }
}

export function saveLocalVerification(v: LocalVerification) {
  const list = getLocalVerifications();
  list.push(v);
  fs.writeFileSync(verificationsPath, JSON.stringify(list, null, 2));
  return v;
}

const heroPointsPath = path.join(process.cwd(), 'hero-points-db.json');

export interface LocalHeroPoints {
  user_id: string;
  points: number;
  reports_count: number;
  verifications_count: number;
  badge_level: string;
}

export function getLocalHeroPoints(): LocalHeroPoints[] {
  try {
    if (!fs.existsSync(heroPointsPath)) {
      return [];
    }
    const fileContent = fs.readFileSync(heroPointsPath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading local hero points DB:', error);
    return [];
  }
}

export function updateLocalHeroPoints(userId: string, pointsToAdd: number, isVerification: boolean) {
  const list = getLocalHeroPoints();
  let idx = list.findIndex(h => h.user_id === userId);
  if (idx === -1) {
    const newHero: LocalHeroPoints = {
      user_id: userId,
      points: pointsToAdd,
      reports_count: isVerification ? 0 : 1,
      verifications_count: isVerification ? 1 : 0,
      badge_level: 'Newcomer'
    };
    list.push(newHero);
    idx = list.length - 1;
  } else {
    list[idx].points += pointsToAdd;
    if (isVerification) {
      list[idx].verifications_count += 1;
    } else {
      list[idx].reports_count += 1;
    }
    
    // Update badge levels based on points
    const pts = list[idx].points;
    if (pts >= 100) {
      list[idx].badge_level = 'Local Champion';
    } else if (pts >= 70) {
      list[idx].badge_level = 'Civic Guardian';
    } else if (pts >= 40) {
      list[idx].badge_level = 'Active Citizen';
    } else if (pts >= 20) {
      list[idx].badge_level = 'Helper';
    }
  }
  fs.writeFileSync(heroPointsPath, JSON.stringify(list, null, 2));
  return list[idx];
}
