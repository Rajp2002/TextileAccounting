/** Fills `{name}` placeholders in a copy string. */
export const fillCopy = (template: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, String(value)), template)
