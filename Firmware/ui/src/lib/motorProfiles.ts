/** Firmware motor type: 0 = Generic PWM, 1 = Xiaomi G */
export const MOTOR_TYPE_XIAOMI_G = 1;

/**
 * Sentinel for a motor-off ramp step. Speed 0 still maps to Eco on Xiaomi G
 * (xgPercentToMode: percent <= 33), so off must use motor_stop instead.
 */
export const MOTOR_RAMP_OFF_STEP = -1;

/** UI speed % for each Xiaomi G ESC mode (matches motor_xiaomi_g.cpp kLevels). */
export const XIAOMI_G_SPEED_ECO = 33;
export const XIAOMI_G_SPEED_MID = 67;
export const XIAOMI_G_SPEED_BOOST = 100;

export const XIAOMI_G_RAMP_STEPS = [
  MOTOR_RAMP_OFF_STEP,
  XIAOMI_G_SPEED_ECO,
  XIAOMI_G_SPEED_MID,
  XIAOMI_G_SPEED_BOOST,
] as const;

export const XIAOMI_G_STEP_LABELS = ['Off', 'Eco', 'Mid', 'Boost'] as const;

export function isXiaomiGMotor(motorType: number | undefined): boolean {
  return motorType === MOTOR_TYPE_XIAOMI_G;
}

export function isMotorRampOffStep(step: number): boolean {
  return step === MOTOR_RAMP_OFF_STEP;
}

export function rampStepLabel(motorType: number | undefined, step: number): string | null {
  if (!isXiaomiGMotor(motorType)) return null;
  const idx = XIAOMI_G_RAMP_STEPS.indexOf(step as (typeof XIAOMI_G_RAMP_STEPS)[number]);
  return idx >= 0 ? XIAOMI_G_STEP_LABELS[idx] : null;
}

export function formatRampStep(motorType: number | undefined, step: number): string {
  const label = rampStepLabel(motorType, step);
  if (label) {
    if (isMotorRampOffStep(step)) return label;
    return `${step}% (${label})`;
  }
  return `${step}%`;
}

export function formatRampSequence(motorType: number | undefined, steps: number[]): string {
  return steps.map((s) => formatRampStep(motorType, s)).join(' → ');
}
