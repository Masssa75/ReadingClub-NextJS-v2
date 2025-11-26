import CalibrationGrid from '@/app/components/CalibrationGrid';

export default function CalibratePage() {
  return (
    <div>
      <div
        className="p-5 rounded mb-5 text-sm leading-relaxed"
        style={{
          background: 'rgba(124, 179, 66, 0.1)',
          borderLeft: '4px solid #7CB342',
        }}
      >
        <strong>Pattern-Based Calibration</strong>
        <br />
        Say each phoneme 3-4 times while recording. The system captures the
        actual waveform pattern (like a fingerprint).
        <br />
        This preserves the SHAPE of the sound, not just statistics.
      </div>

      {/* Proficiency Legend - Ultra Minimal */}
      <div
        className="p-4 rounded mb-5 text-sm"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        <div className="font-bold mb-2 text-white/90">Border Colors Show Progress:</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-[3px]" style={{ borderColor: '#999999' }}></div>
            <span className="text-white/70"><strong>Gray</strong> = Unknown</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-[3px]" style={{ borderColor: '#E5C5A8' }}></div>
            <span className="text-white/70"><strong>Peach</strong> = Sometimes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-[3px]" style={{ borderColor: '#7CB342' }}></div>
            <span className="text-white/70"><strong>Green</strong> = Known</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-[3px]" style={{ borderColor: '#FDD835' }}></div>
            <span className="text-white/70"><strong>Yellow</strong> = Mastered</span>
          </div>
        </div>
      </div>

      <CalibrationGrid />
    </div>
  );
}
