// Color mapping utilities
export const colorMapping: Record<string, string> = {
  red: "#FF0000",
  yellow: "#FFFF00",
  green: "#00FF00",
  blue: "#0000FF",
  magenta: "#FF00FF",
  cyan: "#00FFFF",
};

// Get a color name by index (cycling through available colors)
export function getColorName(index: number): string {
  const keys = Object.keys(colorMapping);
  return keys[index % keys.length];
}

// Assign colors to process names
export function assignColorsToProcesses(
  processNames: string[],
): Record<string, string> {
  const assignedProcessColors: Record<string, string> = {};

  processNames.forEach((name, i) => {
    const colorName = getColorName(i);
    assignedProcessColors[name] = colorMapping[colorName];
  });

  return assignedProcessColors;
}
