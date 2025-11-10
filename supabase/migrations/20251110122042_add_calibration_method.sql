-- Add calibration_method column to track auto vs manual calibration
ALTER TABLE calibrations
ADD COLUMN IF NOT EXISTS calibration_method text DEFAULT 'manual' CHECK (calibration_method IN ('manual', 'auto'));

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_calibrations_method ON calibrations(calibration_method);

-- Comment for documentation
COMMENT ON COLUMN calibrations.calibration_method IS 'Method used for calibration: manual (via Calibrate tab) or auto (via Game auto-calibration)';
