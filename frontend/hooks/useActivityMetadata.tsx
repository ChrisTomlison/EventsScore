"use client";

import { useState, useEffect } from "react";

export type ActivityMetadata = {
  name: string;
  description: string;
  dimensionNames: string[];
  normalizedWeights: number[];
};

const STORAGE_KEY = "eventsScore_activityMetadata";

export const useActivityMetadata = () => {
  const [metadataMap, setMetadataMap] = useState<Map<number, ActivityMetadata>>(new Map());

  useEffect(() => {
    // Load from localStorage on mount
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const map = new Map<number, ActivityMetadata>();
        Object.entries(parsed).forEach(([key, value]) => {
          map.set(Number(key), value as ActivityMetadata);
        });
        setMetadataMap(map);
      }
    } catch (e) {
      console.error("Failed to load activity metadata:", e);
    }
  }, []);

  const saveMetadata = (activityId: number, metadata: ActivityMetadata) => {
    const newMap = new Map(metadataMap);
    newMap.set(activityId, metadata);
    setMetadataMap(newMap);
    
    // Save to localStorage
    try {
      const obj: Record<string, ActivityMetadata> = {};
      newMap.forEach((value, key) => {
        obj[key.toString()] = value;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.error("Failed to save activity metadata:", e);
    }
  };

  const getMetadata = (activityId: number): ActivityMetadata | undefined => {
    return metadataMap.get(activityId);
  };

  const searchActivities = (keyword: string): number[] => {
    const results: number[] = [];
    metadataMap.forEach((metadata, activityId) => {
      const searchText = `${metadata.name} ${metadata.description}`.toLowerCase();
      if (searchText.includes(keyword.toLowerCase())) {
        results.push(activityId);
      }
    });
    return results;
  };

  return {
    saveMetadata,
    getMetadata,
    searchActivities,
    metadataMap,
  };
};

