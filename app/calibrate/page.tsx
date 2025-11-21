import CalibrationGrid from '../components/CalibrationGrid';

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
      <CalibrationGrid />
    </div>
  );
}
