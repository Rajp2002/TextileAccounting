/**
 * The Guide is switched off everywhere for now: no pill, no modal, no tour launcher, no help topics.
 * Every entry point (`PageGuide`, `TourInvitation`) returns null before any hook that records tour
 * state runs, so a hidden Guide leaves each account's tour state exactly as it was. Set this to
 * `false` to bring the Guide back; nothing else needs restoring.
 */
export const GUIDE_SUPPRESSED = true
