"use client";

import { Map, MapMarker, MarkerContent, MarkerTooltip } from "@/components/ui/map";
import { MapPin } from "lucide-react";

export interface StudioMapProps {
  className?: string;
  longitude?: number;
  latitude?: number;
  zoom?: number;
  theme?: "light" | "dark";
  studioName?: string;
  studioAddress?: string;
  pinColor?: string;
  interactive?: boolean;
}

export function StudioMap({
  longitude = -51.1685,
  latitude = -30.0125,
  zoom = 14,
  theme = "light",
  studioName = "Lara Varisa Studio",
  studioAddress = "Zona Norte · Porto Alegre, RS",
  pinColor,
  interactive = true,
  className = "",
}: StudioMapProps) {
  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <Map
        viewport={{
          center: [longitude, latitude],
          zoom,
          pitch: 0,
          bearing: 0,
        }}
        theme={theme}
        interactive={interactive}
        className="w-full h-full min-h-[180px]"
      >
        <MapMarker longitude={longitude} latitude={latitude}>
          <MarkerContent>
            <div className="group relative flex items-center justify-center cursor-pointer transition-transform hover:scale-110">
              <div
                className="absolute w-7 h-7 rounded-full animate-ping opacity-30"
                style={{ backgroundColor: pinColor || "#cca352" }}
              />
              <div
                className="relative w-8 h-8 rounded-full shadow-lg border-2 border-white flex items-center justify-center text-white"
                style={{ backgroundColor: pinColor || "#121211" }}
              >
                <MapPin size={15} className="text-white" />
              </div>
            </div>
          </MarkerContent>
          <MarkerTooltip>
            <div className="text-left py-0.5">
              <strong className="block text-xs font-bold text-white leading-tight">
                {studioName}
              </strong>
              <span className="block text-[10.5px] text-neutral-300 leading-tight mt-0.5">
                {studioAddress}
              </span>
            </div>
          </MarkerTooltip>
        </MapMarker>
      </Map>
    </div>
  );
}
