/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Body,
  Ecliptic,
  Observer,
  GeoVector,
} from "astronomy-engine";
import { PlanetPosition, PLANET_NAMES, BirthDetails } from "../types";

// Vedic Astrology Constants
const LAHIRI_AYANAMSA_J2000 = 23.85; // Approximate at J2000

/**
 * Calculates Lahiri Ayanamsa for a given Julian Date.
 */
export function calculateAyanamsa(jd: number): number {
  const t = (jd - 2451545.0) / 36525.0; // Centuries from J2000
  const ayanamsa = 23.856536 + (5029.0966 * t + 1.11161 * t * t) / 3600.0;
  return ayanamsa;
}

export function getSign(longitude: number): number {
  return Math.floor(longitude / 30) % 12;
}

export function getDegreeInSign(longitude: number): number {
  return longitude % 30;
}

export const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
  "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
];

export function getNakshatra(longitude: number) {
  const index = Math.floor(longitude / (360 / 27));
  const degInNak = longitude % (360 / 27);
  const pada = Math.floor(degInNak / (360 / 108)) + 1;
  return { name: NAKSHATRAS[index], pada, index };
}

export function calculateBirthChart(details: BirthDetails) {
  const date = new Date(`${details.date}T${details.time}:00${details.timezone}`);
  
  // Julian Date
  const jd = (date.getTime() / 86400000) + 2440587.5;
  const ayanamsa = calculateAyanamsa(jd);

  const planets: PlanetPosition[] = [];

  const bodies = [
    Body.Sun,
    Body.Moon,
    Body.Mars,
    Body.Mercury,
    Body.Jupiter,
    Body.Venus,
    Body.Saturn,
  ];

  for (let i = 0; i < bodies.length; i++) {
    const vector = GeoVector(bodies[i], date, true);
    const ecliptic = Ecliptic(vector);
    let siderealLong = (ecliptic.elon - ayanamsa + 360) % 360;
    
    // Simple retrograde check
    const datePast = new Date(date.getTime() - 86400000); // 1 day before
    const vectorPast = GeoVector(bodies[i], datePast, true);
    const eclipticPast = Ecliptic(vectorPast);
    const isRetrograde = ecliptic.elon < eclipticPast.elon;

    const sign = getSign(siderealLong);
    const degInSign = getDegreeInSign(siderealLong);

    planets.push({
      name: PLANET_NAMES[i],
      longitude: siderealLong,
      isRetrograde,
      sign,
      degree: Math.floor(degInSign),
      minute: Math.floor((degInSign % 1) * 60),
      second: Math.floor(((degInSign % 1) * 60 % 1) * 60),
      house: 0,
    });
  }

  // Rahu/Ketu Mean Node
  const T = (jd - 2451545.0) / 36525.0;
  let meanRahu = (125.04452 - 1934.13626 * T + 0.0020708 * T * T + 360000) % 360;
  let siderealRahu = (meanRahu - ayanamsa + 360) % 360;
  
  const addNode = (name: string, long: number) => {
    const sign = getSign(long);
    const degInSign = getDegreeInSign(long);
    planets.push({
      name,
      longitude: long,
      isRetrograde: true,
      sign,
      degree: Math.floor(degInSign),
      minute: Math.floor((degInSign % 1) * 60),
      second: Math.floor(((degInSign % 1) * 60 % 1) * 60),
      house: 0,
    });
  };

  addNode("Rahu", siderealRahu);
  addNode("Ketu", (siderealRahu + 180) % 360);

  // Simplified Ascendant
  // LST (Local Sidereal Time) calculation
  const gmst = (280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T) % 360;
  const lst = (gmst + details.lng + 360) % 360;
  const eps = 23.43929 - 0.013 * T;
  const rad = Math.PI / 180;
  
  const ascRaw = Math.atan2(Math.cos(lst * rad), -(Math.sin(lst * rad) * Math.cos(eps * rad) + Math.tan(details.lat * rad) * Math.sin(eps * rad))) / rad;
  let ascLong = (ascRaw + 360) % 360;
  let siderealAsc = (ascLong - ayanamsa + 360) % 360;

  const ascSign = getSign(siderealAsc);
  const ascPos: PlanetPosition = {
    name: "Ascendant",
    longitude: siderealAsc,
    isRetrograde: false,
    sign: ascSign,
    degree: Math.floor(getDegreeInSign(siderealAsc)),
    minute: Math.floor((getDegreeInSign(siderealAsc) % 1) * 60),
    second: 0,
    house: 1,
  };

  planets.forEach(p => {
    p.house = (p.sign - ascSign + 12) % 12 + 1;
  });

  return { planets, ascendant: ascPos, ayanamsa };
}

export function calculateDashas(moonLongitude: number, birthDate: Date) {
  const dashaPlanets = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
  const dashaYears = [7, 20, 6, 10, 7, 18, 16, 19, 17];
  
  const nakshatraSpan = 360 / 27; // 13.333... degrees
  
  const nakshatraIndex = Math.floor(moonLongitude / nakshatraSpan);
  const planetIndex = nakshatraIndex % 9;
  
  const elapsedInNak = moonLongitude % nakshatraSpan;
  const remainingInNak = nakshatraSpan - elapsedInNak;
  const ratioRemaining = remainingInNak / nakshatraSpan;
  
  const firstDashaYears = dashaYears[planetIndex] * ratioRemaining;
  
  const dashas = [];
  let currentDate = new Date(birthDate);
  
  // First dasha (partial)
  const firstEndDate = new Date(currentDate.getTime() + firstDashaYears * 365.25 * 24 * 60 * 60 * 1000);
  dashas.push({
    planet: dashaPlanets[planetIndex],
    start: new Date(currentDate),
    end: new Date(firstEndDate),
    duration: firstDashaYears
  });
  
  currentDate = new Date(firstEndDate);
  
  // Next 8 dashas to cover a full cycle (roughly 120 years)
  for (let i = 1; i < 9; i++) {
    const idx = (planetIndex + i) % 9;
    const years = dashaYears[idx];
    const endDate = new Date(currentDate.getTime() + years * 365.25 * 24 * 60 * 60 * 1000);
    
    dashas.push({
      planet: dashaPlanets[idx],
      start: new Date(currentDate),
      end: new Date(endDate),
      duration: years
    });
    
    currentDate = new Date(endDate);
  }
  
  return dashas;
}

/**
 * Calculates planetary positions for a specific year (at mid-year)
 * to provide context for yearly predictions.
 */
export function calculateTransitsForYear(year: number, details: BirthDetails) {
  // Use July 2nd (middle of year) for general year transit
  const transitDetails: BirthDetails = {
    ...details,
    date: `${year}-07-02`,
    time: "12:00"
  };
  return calculateBirthChart(transitDetails);
}

// Mock function for Ashta Koota Matching
export function calculateMatching(boyDetails: BirthDetails, girlDetails: BirthDetails) {
  // Real Ashta Koota requires Moon Nakshatra and Pada.
  // Nakshatras are 27 segments of 13°20'
  return {
    score: 24, // Out of 36
    max: 36,
    kootas: [
      { name: "Varna", score: 1, max: 1 },
      { name: "Vashya", score: 2, max: 2 },
      { name: "Tara", score: 1.5, max: 3 },
      { name: "Yoni", score: 2, max: 4 },
      { name: "Graha Maitri", score: 5, max: 5 },
      { name: "Gana", score: 6, max: 6 },
      { name: "Bhakoot", score: 7, max: 7 },
      { name: "Nadi", score: 0, max: 8 },
    ],
    message: "A good match with some Nadi Dosha considerations."
  };
}

// Help function for Sidereal Time if needed
function RotationAxis(date: Date) {
  const jd = (date.getTime() / 86400000) + 2440587.5;
  const T = (jd - 2451545.0) / 36525.0;
  // GMST calculation
  const gmst = (280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000.0) % 360;
  return { msec: gmst / 15 * 3600 * 1000 };
}
