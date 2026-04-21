/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BirthDetails {
  date: string; // ISO format
  time: string; // HH:mm
  lat: number;
  lng: number;
  timezone: string;
  locationName: string;
}

export interface PlanetPosition {
  name: string;
  longitude: number; // 0-360
  isRetrograde: boolean;
  house: number; // 1-12
  sign: number; // 0-11 (Aries to Pisces)
  degree: number; // 0-30
  minute: number;
  second: number;
}

export interface KundliData {
  planets: PlanetPosition[];
  houses: number[]; // Longitudes of house cusps
  ascendant: PlanetPosition;
  ayanamsa: number;
}

export const PLANET_NAMES = [
  "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"
];

export const SIGN_NAMES = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

export const SIGN_SANSKRIT_NAMES = [
  "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
  "Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena"
];
