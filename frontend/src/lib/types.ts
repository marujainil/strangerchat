// Shared types mirrored from the backend API + socket contract.

export type ChatMode = 'VIDEO' | 'AUDIO' | 'TEXT';
export type Gender = 'MALE' | 'FEMALE' | 'NONBINARY' | 'UNKNOWN';
export type RelationshipStatus = 'SINGLE' | 'TAKEN' | 'COMPLICATED' | 'PREFER_NOT';
export type Role = 'USER' | 'MODERATOR' | 'ADMIN';

export interface User {
  id: string;
  email: string | null;
  role: Role;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  gender: Gender;
  age: number | null;
  countryCode: string | null;
  city: string | null;
  languages: string[];
  relationship: RelationshipStatus;
  isVerified: boolean;
  isPremium: boolean;
  isGuest: boolean;
  interests?: string[];
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface Country {
  code: string;
  name: string;
  dialCode: string;
  flagEmoji: string;
}

export interface Interest {
  slug: string;
  label: string;
  id?: string;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  interval: 'MONTHLY' | 'HALF_YEARLY' | 'YEARLY';
  priceInr: number;
  durationDays: number;
  features: string[];
}

export interface MatchFilters {
  genders?: Gender[];
  countries?: string[];
  languages?: string[];
  interests?: string[];
  ageMin?: number;
  ageMax?: number;
  relationship?: RelationshipStatus;
  onlyVerified?: boolean;
  onlyPremium?: boolean;
  newUsersOnly?: boolean;
  distanceKm?: number;
}

export interface PublicPartner {
  userId: string;
  gender: Gender;
  countryCode: string | null;
  languages: string[];
  interests: string[];
  age: number | null;
  isPremium: boolean;
  isVerified: boolean;
  relationship: RelationshipStatus;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface MatchFound {
  roomId: string;
  polite: boolean;
  mode: ChatMode;
  partner: PublicPartner;
  iceServers: IceServer[];
}

export interface ChatMessage {
  id: string;
  self: boolean;
  text: string;
  at: number;
}

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
