"use client";

import React from "react";
import {
  Coffee,
  CupSoda,
  Croissant,
  Sandwich,
  CakeSlice,
  EggFried,
  Utensils,
} from "lucide-react";

export function CategoryIcon({
  name,
  className = "w-5 h-5",
}: {
  name: string;
  className?: string;
}) {
  switch (name) {
    case "Coffee":
      return <Coffee className={className} />;
    case "CupSoda":
      return <CupSoda className={className} />;
    case "Croissant":
      return <Croissant className={className} />;
    case "Sandwich":
      return <Sandwich className={className} />;
    case "CakeSlice":
      return <CakeSlice className={className} />;
    case "EggFried":
      return <EggFried className={className} />;
    default:
      return <Utensils className={className} />;
  }
}

