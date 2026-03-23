"use client";

import { useEffect } from "react";
import { addRecentlyViewedPropertyId } from "@/lib/public/storage";

type Props = {
  propertyId: string;
};

export function TrackRecentlyViewedProperty({ propertyId }: Props) {
  useEffect(() => {
    addRecentlyViewedPropertyId(propertyId);
  }, [propertyId]);

  return null;
}

