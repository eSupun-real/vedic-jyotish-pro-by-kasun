/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  Moon, 
  Sun, 
  Stars, 
  Users, 
  MapPin, 
  Calendar, 
  Clock, 
  Compass,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import { format } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { BirthDetails, KundliData, PlanetPosition, SIGN_NAMES, SIGN_SANSKRIT_NAMES } from "./types";
import { calculateBirthChart, calculateMatching, getNakshatra, calculateDashas, calculateTransitsForYear } from "./lib/astrology";
import { KundliChart } from "./components/KundliChart";
import { SUPPORTED_LANGUAGES, UI_TRANSLATIONS, LanguageCode } from "./lib/translations";
import { History, Search } from "lucide-react";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [step, setStep] = useState<"language" | "input" | "result">("language");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const t = UI_TRANSLATIONS[language] || UI_TRANSLATIONS.en;

  const [activeTab, setActiveTab] = useState<"chart" | "matching" | "horoscope" | "timeline">("chart");
  const [birthDetails, setBirthDetails] = useState<BirthDetails>({
    date: "1990-01-01",
    time: "12:00",
    lat: 28.6139,
    lng: 77.2090,
    timezone: "+05:30",
    locationName: "New Delhi, India"
  });
  const [partnerDetails, setPartnerDetails] = useState<BirthDetails>({
    date: "1992-05-15",
    time: "10:30",
    lat: 19.0760,
    lng: 72.8777,
    timezone: "+05:30",
    locationName: "Mumbai, India"
  });
  const [showPartnerInput, setShowPartnerInput] = useState(false);
  const [matchingResult, setMatchingResult] = useState<any>(null);

  const [chartData, setChartData] = useState<KundliData | null>(null);
  const [dashas, setDashas] = useState<any[]>([]);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [timelinePrediction, setTimelinePrediction] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInput, setShowInput] = useState(true);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [yearlyPrediction, setYearlyPrediction] = useState<string | null>(null);
  const [loadingYearly, setLoadingYearly] = useState(false);

  // Location Autocomplete State
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [activeInput, setActiveInput] = useState<"birth" | "partner" | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedQuery.length >= 3) {
        performSearch(debouncedQuery);
      } else {
        setLocationSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [debouncedQuery]);

  const performSearch = async (query: string) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      const data = await response.json();
      setLocationSuggestions(data);
    } catch (error) {
      console.error("Autocomplete error:", error);
    }
  };

  const selectLocation = (item: any, type: "birth" | "partner") => {
    const updates = {
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      locationName: item.display_name
    };
    if (type === "birth") setBirthDetails({ ...birthDetails, ...updates });
    else setPartnerDetails({ ...partnerDetails, ...updates });
    setLocationSuggestions([]);
    setActiveInput(null);
  };

  const currentLanguageName = SUPPORTED_LANGUAGES.find(l => l.code === language)?.name || 'English';

  const calculateChart = () => {
    setLoading(true);
    try {
      const data = calculateBirthChart(birthDetails);
      setChartData(data);
      
      const moonLong = data.planets.find(p => p.name === "Moon")?.longitude || 0;
      const bDate = new Date(`${birthDetails.date}T${birthDetails.time}:00${birthDetails.timezone}`);
      const computedDashas = calculateDashas(moonLong, bDate);
      setDashas(computedDashas);

      setPrediction(null); // Reset prediction when data changes
      setTimelinePrediction(null);
      setYearlyPrediction(null);
      setStep("result");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateMatching = () => {
    setLoading(true);
    try {
      const result = calculateMatching(birthDetails, partnerDetails);
      setMatchingResult(result);
      setShowPartnerInput(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getAIPrediction = async () => {
    if (!chartData) return;
    setLoading(true);
    try {
      const moonNak = getNakshatra(chartData.planets.find(p => p.name === "Moon")?.longitude || 0);
      const ascNak = getNakshatra(chartData.ascendant.longitude);

      const prompt = `You are a world-class Vedic Astrologer (Jyotish Acharya). 
      Generate a deep, accurate horoscope analysis for someone with the following birth chart:
      - Ascendant: ${SIGN_NAMES[chartData.ascendant.sign]} (Nakshatra: ${ascNak.name}, Pada: ${ascNak.pada})
      - Moon Nakshatra: ${moonNak.name} (Pada: ${moonNak.pada})
      - Planets: ${chartData.planets.map(p => `${p.name} in House ${p.house} (${SIGN_NAMES[p.sign]})`).join(", ")}
      
      Provide a highly detailed analysis including:
      1. Personal Essence & Character: Detailed psychological profile, strengths, and soul purpose (Atmakaraka perspective).
      2. Career & Professional Life (Karma Bhava): Job prospects, business success, and financial status.
      3. Marriage & Relationships (Vivaha Bhava): Detailed analysis of partnership, marital bliss, and social life.
      4. Children & Creativity (Putra Bhava): Insights into offspring, creative intelligence, and legacy.
      5. Detailed forecast for today: ${format(new Date(), "eeee, MMMM do, yyyy")}.
      6. Specific Vedic remedies (Mantras, Gems, or charity) for current challenges.
      
      Mix ancient traditional Jyotish wisdom with modern strategic guidance. Be extremely detailed and exhaustive.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `${prompt}\n\nIMPORTANT: PROVIDE THE ENTIRE RESPONSE IN THE ${currentLanguageName.toUpperCase()} LANGUAGE. Use traditional fonts or symbols if applicable in that language.`,
      });
      setPrediction(response.text || "Unable to generate prediction.");
    } catch (error) {
      console.error(error);
      setPrediction("Error connecting to astrological wisdom. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getTimelineOverview = async () => {
    if (!chartData || dashas.length === 0) return;
    setLoading(true);
    try {
      const prompt = `You are a legendary Vedic Astrologer. 
      Analyze the Life Timeline (Vimshottari Dashas) for the following birth chart:
      - Ascendant: ${SIGN_NAMES[chartData.ascendant.sign]}
      - Planets: ${chartData.planets.map(p => `${p.name} in House ${p.house} (${SIGN_NAMES[p.sign]})`).join(", ")}
      - Dashas: ${dashas.map(d => `${d.planet} Period (${format(d.start, "yyyy")} to ${format(d.end, "yyyy")})`).join(", ")}
      
      Provide a "MASTER LIFE DESTINY REPORT" based on these dashas. 
      For EACH Mahadasha, detail the impact on:
      - Job & Career evolution.
      - Marriage & Relationship timing.
      - Children & Family expansions.
      - Personal Health & Spiritual growth.
      
      Explain significant life-shifting years and milestones based on these planetary periods.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `${prompt}\n\nIMPORTANT: PROVIDE THE ENTIRE RESPONSE IN THE ${currentLanguageName.toUpperCase()} LANGUAGE.`,
      });
      setTimelinePrediction(response.text || "Unable to generate timeline.");
    } catch (error) {
      console.error(error);
      setTimelinePrediction("Error reading the cosmic timeline.");
    } finally {
      setLoading(false);
    }
  };

  const getYearlyPrediction = async (year: number) => {
    if (!chartData) return;
    setLoadingYearly(true);
    try {
      const transits = calculateTransitsForYear(year, birthDetails);
      const currentDasha = dashas.find(d => {
        const y = new Date(`${year}-07-02`); // Check mid-year
        return y >= d.start && y <= d.end;
      });

      const prompt = `You are a world-renowned Vedic Astrologer from Benares. 
      The user seeks a "High Accuracy, Full Detailed Yearly Prediction" for the year ${year}.
      
      Birth Chart (Natal):
      - Ascendant (Lagna): ${SIGN_NAMES[chartData.ascendant.sign]}
      - Natal Planets: ${chartData.planets.map(p => `${p.name} in House ${p.house} (${SIGN_NAMES[p.sign]})`).join(", ")}
      
      Yearly Transit Data (Mid-${year}):
      - Transiting Planets: ${transits.planets.map(p => `${p.name} in ${SIGN_NAMES[p.sign]}`).join(", ")}
      - Major Life Period (Mahadasha): ${currentDasha?.planet || "Seeking calculation..."}
      
      Requirements for accuracy:
      1. Analyze the interaction between transiting Saturn, Jupiter, and Rahu/Ketu with natal planets.
      2. Provide a detailed months-by-months breakdown.
      3. Deep Dive into:
         - Professional Life (Job/Business): Success, transfers, promotions, or status changes (10th/11th houses).
         - Marital life & Relationships: Harmony, wedding timing, or partnership challenges (7th/2nd/8th houses).
         - Children & Next Generation: News of progeny, children's progress, or planning (5th house).
         - Personal growth & Health: Vitality, surgery risks, or spiritual awakenings.
      4. SPECIFIC FAVORABLE DATES: List exact dates for specific actions like marriage proposals, job interviews, or large purchases.
      5. PRECISION: Distinguish between past years (retrospective verification) and future years (predictive guidance).
      
      The user expects traditional Vedic wisdom blended with clear modern strategic advice.
      Structure with bold headers: **Job & Career**, **Marriage & Relationships**, **Children**, **Personal & Health**.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview", // Use Pro for complex reasoning
        contents: `${prompt}\n\nIMPORTANT: PROVIDE THE ENTIRE RESPONSE IN THE ${currentLanguageName.toUpperCase()} LANGUAGE.`,
      });
      setYearlyPrediction(response.text || "Unable to generate yearly prediction.");
    } catch (error) {
      console.error(error);
      setYearlyPrediction("Error calculating yearly transits.");
    } finally {
      setLoadingYearly(false);
    }
  };

  useEffect(() => {
    if (activeTab === "horoscope" && !prediction && chartData) {
      getAIPrediction();
    }
    if (activeTab === "timeline" && !timelinePrediction && chartData) {
      getTimelineOverview();
    }
  }, [activeTab, chartData]);

  const moonData = chartData ? getNakshatra(chartData.planets.find(p => p.name === "Moon")?.longitude || 0) : null;
  const ascData = chartData ? getNakshatra(chartData.ascendant.longitude) : null;

  return (
    <div className="min-h-screen bg-[#FDF9F3] text-amber-950 font-sans selection:bg-orange-200">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-5">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-orange-400 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-amber-400 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 bg-[#FDF9F3]/80 backdrop-blur-md border-b border-amber-200/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-200">
            <Stars className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{t.title}</h1>
            <div className="flex flex-col">
              <p className="text-[10px] uppercase tracking-widest text-amber-700/70 font-semibold leading-tight">{t.subtitle}</p>
              <p className="text-[8px] uppercase tracking-widest font-bold text-amber-900/40 mt-0.5 whitespace-nowrap">© 2026 Kasun Aravinda</p>
            </div>
          </div>
        </div>
        {step !== "language" && (
          <div className="flex gap-2">
            <button 
              onClick={() => setStep("language")}
              className="text-[10px] font-bold px-3 py-1.5 rounded-full border border-amber-200 bg-white hover:bg-amber-50 uppercase tracking-wider"
            >
              {language.toUpperCase()}
            </button>
            {step === "result" && (
              <button 
                onClick={() => setStep("input")}
                className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-amber-900 text-white hover:bg-amber-800 uppercase tracking-wider"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {step === "language" ? (
            <motion.div
              key="language"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-serif italic text-amber-900">{t.selectLanguage}</h2>
                <p className="text-amber-700/60">Choose your preferred language for predictions and navigation.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code as LanguageCode);
                      setStep("input");
                    }}
                    className={cn(
                      "p-4 rounded-2xl border transition-all text-center space-y-1",
                      language === lang.code 
                        ? "bg-amber-900 text-white border-amber-900 shadow-lg shadow-amber-900/20" 
                        : "bg-white border-amber-100 hover:border-amber-300 hover:bg-amber-50"
                    )}
                  >
                    <p className="text-sm font-bold">{lang.native}</p>
                    <p className="text-[10px] opacity-60 uppercase font-bold tracking-widest">{lang.name}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          ) : step === "input" ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-serif italic text-amber-900">{t.enterBirthDetails}</h2>
                <p className="text-amber-700/60 max-w-sm mx-auto">{t.birthDetailsDesc}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <InputGroup label={t.birthDate} icon={<Calendar className="w-4 h-4" />}>
                  <input 
                    type="date" 
                    value={birthDetails.date}
                    onChange={(e) => setBirthDetails({ ...birthDetails, date: e.target.value })}
                    className="w-full bg-white/50 border border-amber-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  />
                </InputGroup>
                
                <InputGroup label={t.birthTime} icon={<Clock className="w-4 h-4" />}>
                  <input 
                    type="time" 
                    value={birthDetails.time}
                    onChange={(e) => setBirthDetails({ ...birthDetails, time: e.target.value })}
                    className="w-full bg-white/50 border border-amber-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  />
                </InputGroup>

                <div className="sm:col-span-2">
                  <InputGroup label={t.location} icon={<MapPin className="w-4 h-4" />}>
                    <div className="relative">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder={t.searchCity}
                          value={birthDetails.locationName}
                          onChange={(e) => {
                            setBirthDetails({ ...birthDetails, locationName: e.target.value });
                            setDebouncedQuery(e.target.value);
                            setActiveInput("birth");
                          }}
                          className="flex-1 bg-white/50 border border-amber-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        />
                        <button 
                          onClick={() => {
                            navigator.geolocation.getCurrentPosition((pos) => {
                              setBirthDetails({
                                ...birthDetails,
                                lat: pos.coords.latitude,
                                lng: pos.coords.longitude,
                                locationName: "Current Location"
                              });
                            });
                          }}
                          className="p-3 rounded-xl border border-amber-200 hover:bg-amber-100 transition-colors"
                          title="Use Current Location"
                        >
                          <Compass className="w-5 h-5" />
                        </button>
                      </div>

                      {activeInput === "birth" && locationSuggestions.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-amber-100 overflow-hidden max-h-60 overflow-y-auto">
                          {locationSuggestions.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => selectLocation(item, "birth")}
                              className="w-full text-left px-4 py-3 text-xs hover:bg-amber-50 border-b border-amber-50 last:border-0 transition-colors"
                            >
                              <p className="font-bold text-amber-900">{item.display_name.split(',')[0]}</p>
                              <p className="text-[10px] text-amber-700/60 truncate">{item.display_name}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </InputGroup>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={calculateChart}
                className="w-full py-4 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-orange-900/10 flex items-center justify-center gap-2"
              >
                {loading ? t.calculating : t.generateChart}
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Navigation */}
              <div className="flex items-center gap-1 p-1 bg-amber-100/50 rounded-full">
                <NavButton 
                  active={activeTab === "chart"} 
                  onClick={() => setActiveTab("chart")}
                  icon={<Stars className="w-4 h-4" />}
                  label={t.chart}
                />
                <NavButton 
                  active={activeTab === "matching"} 
                  onClick={() => setActiveTab("matching")}
                  icon={<Users className="w-4 h-4" />}
                  label={t.matching}
                />
                <NavButton 
                  active={activeTab === "horoscope"} 
                  onClick={() => setActiveTab("horoscope")}
                  icon={<Sparkles className="w-4 h-4" />}
                  label={t.horoscope}
                />
                <NavButton 
                  active={activeTab === "timeline"} 
                  onClick={() => setActiveTab("timeline")}
                  icon={<History className="w-4 h-4" />}
                  label={t.timeline}
                />
              </div>

              {activeTab === "chart" && chartData && (
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-100">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-serif italic text-xl">{t.rasiChart}</h3>
                      <div className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        {t.lagna}: {SIGN_NAMES[chartData.ascendant.sign]}
                      </div>
                    </div>
                    <KundliChart 
                      planets={chartData.planets} 
                      ascendantSign={chartData.ascendant.sign} 
                      planetAbbr={t.planetAbbr}
                    />
                    
                    <div className="mt-8 grid grid-cols-2 gap-4">
                      <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                        <p className="text-[10px] uppercase font-bold text-amber-600 mb-1">{t.lagnaNakshatra}</p>
                        <p className="font-serif italic text-lg">{ascData?.name}</p>
                        <p className="text-[10px] text-amber-700/60 leading-none">Pada {ascData?.pada}</p>
                      </div>
                      <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                        <p className="text-[10px] uppercase font-bold text-amber-600 mb-1">{t.janmaNakshatra}</p>
                        <p className="font-serif italic text-lg">{moonData?.name}</p>
                        <p className="text-[10px] text-amber-700/60 leading-none">Pada {moonData?.pada}</p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2 justify-center">
                      {SIGN_SANSKRIT_NAMES.map((name, i) => (
                        <div key={i} className="text-[8px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 flex gap-1">
                          <span className="font-bold">{i+1}</span>
                          <span className="opacity-70">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-amber-100">
                    <table className="w-full text-left">
                      <thead className="bg-amber-50/50 text-[10px] uppercase tracking-wider font-bold">
                        <tr>
                          <th className="px-4 py-3">{t.planet}</th>
                          <th className="px-4 py-3">{t.sign}</th>
                          <th className="px-4 py-3">{t.house}</th>
                          <th className="px-4 py-3">{t.degree}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-50">
                        {chartData.planets.map((p, i) => (
                          <tr key={i} className="hover:bg-amber-50/20 transition-colors">
                            <td className="px-4 py-3 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                              <span className="font-semibold text-sm">{p.name}</span>
                              {p.isRetrograde && <span className="text-[10px] text-red-500 font-bold">(R)</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-amber-800">{SIGN_NAMES[p.sign]} ({SIGN_SANSKRIT_NAMES[p.sign]})</td>
                            <td className="px-4 py-3 text-xs font-mono">{p.house}</td>
                            <td className="px-4 py-3 text-xs font-mono">{p.degree}° {p.minute}' {p.second}"</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "matching" && (
                <div className="space-y-6">
                  {showPartnerInput || !matchingResult ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-3xl p-6 shadow-sm border border-amber-100 space-y-6"
                    >
                      <div className="text-center space-y-1">
                        <h3 className="text-xl font-serif italic">{t.partnerJourney}</h3>
                        <p className="text-xs text-amber-700/60">{t.partnerDesc}</p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <InputGroup label={t.birthDate} icon={<Calendar className="w-4 h-4" />}>
                          <input 
                            type="date" 
                            value={partnerDetails.date}
                            onChange={(e) => setPartnerDetails({ ...partnerDetails, date: e.target.value })}
                            className="w-full bg-white/50 border border-amber-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                          />
                        </InputGroup>
                        <InputGroup label={t.birthTime} icon={<Clock className="w-4 h-4" />}>
                          <input 
                            type="time" 
                            value={partnerDetails.time}
                            onChange={(e) => setPartnerDetails({ ...partnerDetails, time: e.target.value })}
                            className="w-full bg-white/50 border border-amber-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                          />
                        </InputGroup>
                        <div className="sm:col-span-2">
                          <InputGroup label={t.location} icon={<MapPin className="w-4 h-4" />}>
                            <div className="relative">
                              <input 
                                type="text" 
                                value={partnerDetails.locationName}
                                onChange={(e) => {
                                  setPartnerDetails({ ...partnerDetails, locationName: e.target.value });
                                  setDebouncedQuery(e.target.value);
                                  setActiveInput("partner");
                                }}
                                className="w-full bg-white/50 border border-amber-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                placeholder={t.searchCity}
                              />
                              {activeInput === "partner" && locationSuggestions.length > 0 && (
                                <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-amber-100 overflow-hidden max-h-60 overflow-y-auto">
                                  {locationSuggestions.map((item, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => selectLocation(item, "partner")}
                                      className="w-full text-left px-4 py-3 text-xs hover:bg-amber-50 border-b border-amber-50 last:border-0 transition-colors"
                                    >
                                      <p className="font-bold text-amber-900">{item.display_name.split(',')[0]}</p>
                                      <p className="text-[10px] text-amber-700/60 truncate">{item.display_name}</p>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </InputGroup>
                        </div>
                      </div>

                      <button
                        onClick={handleCalculateMatching}
                        className="w-full py-4 bg-amber-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-amber-800 transition-colors"
                      >
                        {loading ? t.calculating : t.checkCompatibility}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white rounded-3xl p-8 shadow-sm border border-amber-100 text-center space-y-6"
                    >
                      <div className="relative inline-block">
                        <div className="absolute inset-0 bg-orange-200 blur-2xl opacity-20 animate-pulse rounded-full" />
                        <div className="relative w-32 h-32 rounded-full border-8 border-orange-50 flex flex-col items-center justify-center mx-auto bg-white shadow-inner">
                          <span className="text-4xl font-serif font-bold text-orange-600">
                            {matchingResult.score}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-amber-900/40 -mt-1">
                            / {matchingResult.max}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-2xl font-serif italic text-amber-900">{t.gunaMilan}</h3>
                        <p className="text-sm text-amber-800 font-medium px-4 py-2 bg-amber-50 rounded-full inline-block">
                          {matchingResult.message}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-4">
                        {matchingResult.kootas.map((k: any, i: number) => (
                          <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-amber-50/50 border border-amber-100/50">
                            <span className="text-[10px] uppercase font-bold text-amber-700/70">{k.name}</span>
                            <span className="text-xs font-mono font-bold text-amber-900">
                              {k.score}<span className="text-amber-900/30">/{k.max}</span>
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowPartnerInput(true)}
                          className="flex-1 py-3 border border-amber-200 rounded-xl text-sm font-bold text-amber-800 hover:bg-amber-50 transition-colors"
                        >
                          {t.changePartner}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {activeTab === "horoscope" && (
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-100">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-serif italic text-xl flex items-center gap-2">
                        <Moon className="w-5 h-5 text-amber-500" />
                        {t.cosmicInsight}
                      </h3>
                      <button 
                        onClick={getAIPrediction}
                        className="text-[10px] uppercase font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded flex items-center gap-1"
                        disabled={loading}
                      >
                        <Sparkles className="w-3 h-3" />
                        {t.refresh}
                      </button>
                    </div>
                    
                    {loading ? (
                      <div className="py-12 flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-4 border-amber-200 border-t-orange-500 rounded-full animate-spin" />
                        <p className="text-xs font-semibold animate-pulse">Scanning Lunar Mansions...</p>
                      </div>
                    ) : (
                      <div className="prose prose-amber max-w-none text-amber-900/80 leading-relaxed text-sm whitespace-pre-line">
                        {prediction}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "timeline" && (
                <div className="space-y-6">
                  {/* Dasha Table */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-100 overflow-hidden">
                    <h3 className="font-serif italic text-xl mb-4 flex items-center gap-2">
                       <History className="w-5 h-5 text-amber-500" />
                       Vimshottari Dasha
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-amber-50 text-[10px] uppercase font-bold text-amber-600">
                          <tr>
                            <th className="px-4 py-2">Dasha</th>
                            <th className="px-4 py-2">Start</th>
                            <th className="px-4 py-2">End</th>
                            <th className="px-4 py-2">Years</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-50">
                          {dashas.map((d, i) => {
                            const isCurrent = new Date() >= d.start && new Date() <= d.end;
                            return (
                              <tr key={i} className={cn("text-xs transition-colors", isCurrent ? "bg-orange-50 font-bold" : "hover:bg-amber-50/20 text-amber-700/70")}>
                                <td className="px-4 py-3 flex items-center gap-2">
                                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}
                                  {d.planet}
                                </td>
                                <td className="px-4 py-3">{format(d.start, "MMM yyyy")}</td>
                                <td className="px-4 py-3">{format(d.end, "MMM yyyy")}</td>
                                <td className="px-4 py-3">{Math.round(d.duration)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Year Selection for Detailed Prediction */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-100 space-y-4">
                    <h3 className="font-serif italic text-xl flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-amber-500" />
                      {t.yearByYear}
                    </h3>
                    <p className="text-xs text-amber-700/60">Select a year to get deep accurate predictions (Past or Future).</p>
                    
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input 
                          type="number" 
                          min={1900} 
                          max={2100}
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                          className="w-full bg-amber-50/50 border border-amber-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <button 
                        onClick={() => getYearlyPrediction(selectedYear)}
                        disabled={loadingYearly}
                        className="p-3 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-colors disabled:opacity-50"
                      >
                        <Search className="w-5 h-5" />
                      </button>
                    </div>

                    <AnimatePresence mode="wait">
                      {loadingYearly ? (
                        <motion.div 
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="py-8 text-center space-y-4"
                        >
                          <div className="w-8 h-8 border-4 border-amber-200 border-t-orange-500 rounded-full animate-spin mx-auto" />
                          <p className="text-xs font-semibold animate-pulse text-amber-700">Calculating Year {selectedYear} Transits...</p>
                        </motion.div>
                      ) : yearlyPrediction ? (
                        <motion.div 
                          key="prediction"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="prose prose-amber max-w-none text-amber-900/80 leading-relaxed text-sm whitespace-pre-line bg-amber-50/30 p-4 rounded-2xl border border-amber-100"
                        >
                          <div className="font-bold text-amber-900 mb-2 border-b border-amber-200 pb-2 flex justify-between items-center text-xs uppercase tracking-widest">
                            <span>Year {selectedYear} Analysis</span>
                            <Sparkles className="w-3 h-3 text-orange-500" />
                          </div>
                          {yearlyPrediction}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  {/* Life Path Interpretation */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-100 space-y-4">
                    <h3 className="font-serif italic text-xl flex items-center gap-2">
                      <Info className="w-5 h-5 text-amber-500" />
                      {t.lifePath}
                    </h3>
                    
                    {loading && !timelinePrediction ? (
                      <div className="py-12 flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-4 border-amber-200 border-t-orange-500 rounded-full animate-spin" />
                        <p className="text-xs font-semibold animate-pulse">Consulting the Akashic Records...</p>
                      </div>
                    ) : (
                      <div className="prose prose-amber max-w-none text-amber-900/80 leading-relaxed text-sm whitespace-pre-line">
                        {timelinePrediction}
                        <button 
                          onClick={getTimelineOverview}
                          className="mt-4 text-[10px] items-center gap-1 uppercase font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full hover:bg-orange-100 transition-colors"
                        >
                          Refresh Overview
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-auto border-t border-amber-200/50 py-8 px-4 text-center">
        <p className="text-[10px] uppercase tracking-widest font-bold text-amber-700/40">
          Built according to the Brhat Parashara Hora Shastra
        </p>
      </footer>
    </div>
  );
}

function InputGroup({ label, children, icon }: { label: string; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-widest text-amber-700 flex items-center gap-2">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold transition-all",
        active ? "bg-white text-orange-700 shadow-sm" : "text-amber-700/60 hover:text-amber-900"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
