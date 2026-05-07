export const VALIDATION_RUBRIC = `An authentic badamangal/bhandara setup typically shows: large communal cooking vessels (kadhai, deg, pateela); volunteers preparing or distributing food; rows of seated devotees being served on plates or banana leaves; saffron-clad organisers; temple, courtyard, pandal, or public-square setting; marigold garlands or other devotional decorations; visible food items like puri, sabzi, halwa, kheer, prasad.

Reject with is_authentic=false: restaurants, weddings, generic crowd shots, food selfies, stock photos, screenshots, indoor home cooking, food delivery, photos that contain only people without food/cooking context, photos with overlaid memes/text/watermarks, photos that are clearly not from India.

Use the 3 reference images as exemplars of "authentic". Be conservative: when in doubt, reject and explain what is missing.`;

export const RESPONSE_SCHEMA = {
  type: "object",
  required: ["is_authentic", "confidence", "reason"],
  properties: {
    is_authentic: { type: "boolean" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    reason: { type: "string" },
  },
  additionalProperties: false,
} as const;
