export interface FeatureSummary {
  slug: string;
  title: string;
  summary: string;
  icon: string;
}

export const publicFeatures: readonly FeatureSummary[] = [
  {
    slug: "a-living-world",
    title: "A Living World",
    summary:
      "Cities, institutions, populations and histories keep moving even when the player is elsewhere.",
    icon: "/assets/feature_icon_01.jpg",
  },
  {
    slug: "forge-your-path",
    title: "Forge Your Path",
    summary:
      "Speak and act without dialogue menus; people respond to what you say and what they know.",
    icon: "/assets/feature_icon_02.jpg",
  },
  {
    slug: "real-challenges",
    title: "Real Challenges",
    summary:
      "Puzzles test reasoning through language, numbers, sound, space, history and construction.",
    icon: "/assets/feature_icon_03.jpg",
  },
  {
    slug: "leave-your-mark",
    title: "Leave Your Mark",
    summary:
      "Consequences persist through people, places, institutions, relationships and later scenes.",
    icon: "/assets/feature_icon_04.jpg",
  },
  {
    slug: "the-power-of-three",
    title: "The Power of Three",
    summary:
      "Three moons and the Beacon cycle shape the sky without exposing hidden story structure.",
    icon: "/assets/feature_icon_05.jpg",
  },
  {
    slug: "truth-still-matters",
    title: "Truth Still Matters",
    summary:
      "Rumor, belief, source-backed facts and later corrections remain distinguishable.",
    icon: "/assets/feature_icon_06.jpg",
  },
  {
    slug: "real-life-comes-first",
    title: "Real Life Comes First",
    summary:
      "Ordinary interruptions do not punish the player; explicit challenge timers are shown clearly.",
    icon: "/assets/feature_icon_07.jpg",
  },
  {
    slug: "speak-or-type-freely",
    title: "Speak or Type Freely",
    summary:
      "NPC interaction accepts natural speech or text instead of numbered dialogue choices.",
    icon: "/assets/feature_icon_08.jpg",
  },
  {
    slug: "a-unique-and-powerful-story",
    title: "A Unique and Powerful Story",
    summary:
      "A continuing character moves through books, companions, cities, puzzles and discoveries.",
    icon: "/assets/feature_icon_09.jpg",
  },
] as const;

export const inviteConsent = "I agree to be contacted by email.";
