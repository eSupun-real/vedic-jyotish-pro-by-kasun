/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { SIGN_NAMES, SIGN_SANSKRIT_NAMES, PlanetPosition } from "../types";

interface KundliChartProps {
  planets: PlanetPosition[];
  ascendantSign: number;
  planetAbbr: Record<string, string>;
}

const getElementalColor = (signZeroBased: number) => {
  const element = signZeroBased % 4;
  switch (element) {
    case 0: return "#EF4444"; // Fire (Aries, Leo, Sagi)
    case 1: return "#059669"; // Earth (Taurus, Virgo, Cap)
    case 2: return "#2563EB"; // Air (Gemini, Libra, Aqua)
    case 3: return "#7C3AED"; // Water (Cancer, Scorpio, Pisces)
    default: return "#92400e";
  }
};

/**
 * North Indian Style Kundli Chart (Diamond Chart)
 */
export const KundliChart: React.FC<KundliChartProps> = ({ planets, ascendantSign, planetAbbr }) => {
  const getHouseData = (houseNum: number) => {
    const signNum = (ascendantSign + houseNum - 1) % 12; // 0-indexed
    const housePlanets = planets.filter((p) => p.house === houseNum).map(p => ({
      label: planetAbbr[p.name] || p.name.substring(0, 2),
      color: getElementalColor(p.sign)
    }));
    return { sign: signNum + 1, planets: housePlanets, color: getElementalColor(signNum) };
  };

  const SIZE = 400;
  const HALF = SIZE / 2;
  const QUART = SIZE / 4;

  const houses = [
    { num: 1, x: HALF, y: QUART },
    { num: 2, x: QUART, y: QUART / 2 },
    { num: 3, x: QUART / 2, y: QUART },
    { num: 4, x: QUART, y: HALF },
    { num: 5, x: QUART / 2, y: SIZE - QUART },
    { num: 6, x: QUART, y: SIZE - QUART / 2 },
    { num: 7, x: HALF, y: SIZE - QUART },
    { num: 8, x: SIZE - QUART, y: SIZE - QUART / 2 },
    { num: 9, x: SIZE - QUART / 2, y: SIZE - QUART },
    { num: 10, x: SIZE - QUART, y: HALF },
    { num: 11, x: SIZE - QUART / 2, y: QUART },
    { num: 12, x: SIZE - QUART, y: QUART / 2 },
  ];

  return (
    <div className="relative w-full max-w-[400px] aspect-square mx-auto">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full h-full border-2 border-amber-800 bg-orange-50/30 rounded-lg overflow-visible"
      >
        {/* Main Frame */}
        <line x1="0" y1="0" x2={SIZE} y2={SIZE} stroke="#92400e" strokeWidth="1" opacity="0.4" />
        <line x1={SIZE} y1="0" x2="0" y2={SIZE} stroke="#92400e" strokeWidth="1" opacity="0.4" />
        
        {/* Inner Diamonds */}
        <polygon
          points={`${HALF},0 ${SIZE},${HALF} ${HALF},${SIZE} 0,${HALF}`}
          fill="none"
          stroke="#92400e"
          strokeWidth="2"
        />

        {houses.map((house) => {
          const data = getHouseData(house.num);
          return (
            <HouseContent 
              key={house.num}
              x={house.x} 
              y={house.y} 
              sign={data.sign} 
              signColor={data.color}
              planets={data.planets} 
            />
          );
        })}
      </svg>
    </div>
  );
};

interface HouseContentProps {
  x: number;
  y: number;
  sign: number;
  signColor: string;
  planets: { label: string; color: string }[];
}

const HouseContent: React.FC<HouseContentProps> = ({ x, y, sign, signColor, planets }) => (
  <g>
    <motion.text
      layout
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      x={x}
      y={y}
      textAnchor="middle"
      fontSize="14"
      fontWeight="900"
      fill={signColor}
      className="select-none font-serif drop-shadow-sm"
    >
      {sign}
    </motion.text>
    {planets.map((p, i) => (
      <motion.text
        key={p.label + i}
        layout
        initial={{ opacity: 0, y: y + 10 }}
        animate={{ opacity: 1, y: y + 16 + i * 14 }}
        x={x}
        textAnchor="middle"
        fontSize="11"
        fontWeight="bold"
        fill={p.color}
        className="select-none font-sans"
      >
        {p.label}
      </motion.text>
    ))}
  </g>
);
