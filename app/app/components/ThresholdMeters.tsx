'use client';

interface ThresholdMetersProps {
  volume: number;
  volumeThreshold: number;
  concentration: number;
  concentrationThreshold: number;
}

export default function ThresholdMeters({
  volume,
  volumeThreshold,
  concentration,
  concentrationThreshold
}: ThresholdMetersProps) {
  // Calculate fill percentages (cap at 2x threshold for visualization)
  const maxVolume = volumeThreshold * 2;
  const volumePercent = Math.min(100, (volume / maxVolume) * 100);
  const volumeThresholdPercent = (volumeThreshold / maxVolume) * 100;

  const maxConcentration = concentrationThreshold * 2;
  const concentrationPercent = Math.min(100, (concentration / maxConcentration) * 100);
  const concentrationThresholdPercent = (concentrationThreshold / maxConcentration) * 100;

  // Color coding: red below threshold, yellow near threshold, green above
  const getVolumeColor = () => {
    if (volume >= volumeThreshold) return '#4CAF50'; // Green
    if (volume >= volumeThreshold * 0.8) return '#FDD835'; // Yellow
    return '#f44336'; // Red
  };

  const getConcentrationColor = () => {
    if (concentration >= concentrationThreshold) return '#4CAF50'; // Green
    if (concentration >= concentrationThreshold * 0.8) return '#FDD835'; // Yellow
    return '#f44336'; // Red
  };

  return (
    <div className="my-5 p-4 bg-black/30 rounded-[10px]">
      <div className="text-[#aaa] text-xs font-bold mb-3">🎤 Voice Detection Thresholds</div>

      {/* Volume Meter */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[#ddd] text-[11px]">Volume</span>
          <span className="text-[#ddd] text-[11px]">
            {Math.round(volume)} / {volumeThreshold}
          </span>
        </div>
        <div className="relative w-full h-5 bg-white/10 rounded-[10px] overflow-hidden">
          <div
            className="h-full rounded-[10px]"
            style={{
              width: `${volumePercent}%`,
              background: getVolumeColor(),
            }}
          />
          {/* Threshold marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-[#FDD835]"
            style={{
              left: `${volumeThresholdPercent}%`,
              boxShadow: '0 0 4px #FDD835',
            }}
          />
        </div>
      </div>

      {/* Energy Concentration Meter */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[#ddd] text-[11px]">Energy Focus</span>
          <span className="text-[#ddd] text-[11px]">
            {concentration.toFixed(1)} / {concentrationThreshold.toFixed(1)}
          </span>
        </div>
        <div className="relative w-full h-5 bg-white/10 rounded-[10px] overflow-hidden">
          <div
            className="h-full rounded-[10px]"
            style={{
              width: `${concentrationPercent}%`,
              background: getConcentrationColor(),
            }}
          />
          {/* Threshold marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-[#FDD835]"
            style={{
              left: `${concentrationThresholdPercent}%`,
              boxShadow: '0 0 4px #FDD835',
            }}
          />
        </div>
      </div>
    </div>
  );
}
