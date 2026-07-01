export type ChatMode = 'VIDEO' | 'AUDIO' | 'TEXT';
export type Gender = 'MALE' | 'FEMALE' | 'NONBINARY' | 'UNKNOWN';

export interface MatchFilters {
  genders?: Gender[];           // genders the seeker wants to meet
  countries?: string[];         // ISO-2 codes
  languages?: string[];
  interests?: string[];         // interest slugs
  ageMin?: number;
  ageMax?: number;
  relationship?: string[];
  onlyVerified?: boolean;
  onlyPremium?: boolean;
  newUsersOnly?: boolean;       // accounts < 7 days
  distanceKm?: number;          // requires lat/lng on both
}

export interface MatchProfile {
  userId: string;
  socketId: string;
  mode: ChatMode;
  isPremium: boolean;
  isVerified: boolean;
  gender: Gender;
  age?: number;
  countryCode?: string;
  languages: string[];
  interests: string[];
  relationship?: string;
  accountAgeDays: number;
  lat?: number;
  lng?: number;
  filters: MatchFilters;        // empty/ignored for free users
  joinedAt: number;
}

export interface MatchResult {
  roomId: string;
  partner: MatchProfile;
  /** Polite peer performs rollback on glare (WebRTC perfect negotiation). */
  polite: boolean;
}
