import { managedAssetUrl } from "./managed-assets";

export interface FeatureSummary {
  slug: string;
  title: string;
  summary: string;
  icon: string;
  image?: string;
  tagline: string;
  detail: string;
  playerChange: string;
  practice: readonly string[];
}

export const publicFeatures: readonly FeatureSummary[] = [
  {
    slug: "a-living-world",
    title: "A Living World",
    summary:
      "Cities, institutions, populations and histories keep moving even when the player is elsewhere.",
    icon: managedAssetUrl("feature.icon.01"),
    image: managedAssetUrl("feature.a-living-world"),
    tagline: "The world keeps moving.",
    detail: "Cities, institutions and characters continue to change as time passes. You are entering a place with its own history, pressures and relationships - not a sequence of rooms waiting for the player to trigger them.",
    playerChange: "The point is not background simulation for its own sake. The point is that context matters when you arrive.",
    practice: ["Persistent people and places", "History changes what exists now", "Knowledge depends on what you have learned", "Travel reveals different parts of the same world"],
  },
  {
    slug: "forge-your-path",
    title: "Forge Your Path",
    summary:
      "Speak and act without dialogue menus; people respond to what you say and what they know.",
    icon: managedAssetUrl("feature.icon.02"),
    image: managedAssetUrl("feature.forge-your-path"),
    tagline: "Choose what matters. Discover what follows.",
    detail: "You are not repeatedly choosing from a list of prewritten branches. You decide where to travel, what to investigate, whom to speak with, what to ask, and what deserves another look.",
    playerChange: "Where you go matters. What you learn matters. What you do with it matters.",
    practice: ["Choose your next destination", "Ask your own questions", "Discover information in different orders", "Consequences persist"],
  },
  {
    slug: "real-challenges",
    title: "Real Challenges",
    summary:
      "Puzzles test reasoning through language, numbers, sound, space, history and construction.",
    icon: managedAssetUrl("feature.icon.03"),
    image: managedAssetUrl("feature.real-challenges"),
    tagline: "Challenges that ask you to pay attention.",
    detail: "Puzzles are built around observation, logic, language, history, sound, space and construction. They are meant to feel like part of the world rather than a detached minigame checklist.",
    playerChange: "A challenge should be satisfying because you solved it - not because the interface told you which answer was safe.",
    practice: ["Multiple puzzle families", "Difficulty progresses deliberately", "Hints are available in sequence", "Retry without turning failure into busywork"],
  },
  {
    slug: "leave-your-mark",
    title: "Leave Your Mark",
    summary:
      "Consequences persist through people, places, institutions, relationships and later scenes.",
    icon: managedAssetUrl("feature.icon.04"),
    image: managedAssetUrl("feature.leave-your-mark"),
    tagline: "The world remembers meaningful actions.",
    detail: "Choices can affect relationships, discovered places, what information becomes available, and how later events are understood. The game does not need a giant morality meter to remember what happened.",
    playerChange: "Your history with the world should be visible in what becomes possible later.",
    practice: ["Relationships can change", "Places can open or close", "Knowledge can expand or be corrected", "Later opportunities can shift"],
  },
  {
    slug: "the-power-of-three",
    title: "The Power of Three",
    summary:
      "Three moons and the Beacon cycle shape the sky without exposing hidden story structure.",
    icon: managedAssetUrl("feature.icon.05"),
    tagline: "Power is rarely a two-sided argument.",
    detail: "Echoes is interested in pressure, compromise, competing values and the way different forces can interpret the same event. A situation can have more than one serious answer without pretending every answer is equally true.",
    playerChange: "The feature is about tension and leverage - not exposing the hidden structure behind the story.",
    practice: ["Competing interests", "Different interpretations", "Power can change hands", "Consequences remain concrete"],
  },
  {
    slug: "truth-still-matters",
    title: "Truth Still Matters",
    summary:
      "Rumor, belief, source-backed facts and later corrections remain distinguishable.",
    icon: managedAssetUrl("feature.icon.06"),
    image: managedAssetUrl("feature.truth-still-matters"),
    tagline: "Belief can change. Facts do not become whatever is convenient.",
    detail: "Characters can be wrong, governments can distort events, records can be incomplete, and the player can misunderstand what happened. Echoes keeps objective events separate from belief so discovery can genuinely change understanding.",
    playerChange: "The story can be uncertain without treating truth as meaningless.",
    practice: ["Characters have limited knowledge", "Public belief can diverge from reality", "Dates and context can become clearer", "Corrections matter"],
  },
  {
    slug: "real-life-comes-first",
    title: "Real Life Comes First",
    summary:
      "Ordinary interruptions do not punish the player; explicit challenge timers are shown clearly.",
    icon: managedAssetUrl("feature.icon.07"),
    image: managedAssetUrl("feature.real-life-comes-first"),
    tagline: "The game should fit around your life.",
    detail: "You should be able to step away and come back. Timed challenges are explicit commitments that begin when you choose to accept them; ordinary play should not manufacture anxiety just to increase engagement.",
    playerChange: "Your time outside the game matters more than keeping a streak alive.",
    practice: ["Step away and return", "Timed challenges are explicit", "Accessibility settings remain available", "No pressure to pay to keep up"],
  },
  {
    slug: "speak-or-type-freely",
    title: "Speak or Type Freely",
    summary:
      "NPC interaction accepts natural speech or text instead of numbered dialogue choices.",
    icon: managedAssetUrl("feature.icon.08"),
    image: managedAssetUrl("feature.speak-or-type-freely"),
    tagline: "Talk to characters like people, not menu options.",
    detail: "Speak or type naturally. Characters answer from what they know, believe, remember and are willing to say. The direction of a conversation comes from your questions instead of a conventional dialogue tree.",
    playerChange: "The important choice is often what you decide to ask next.",
    practice: ["No dialogue-option menus", "Voice or text", "Character knowledge is limited", "Questions can redirect an investigation"],
  },
  {
    slug: "a-unique-and-powerful-story",
    title: "A Unique and Powerful Story",
    summary:
      "A continuing character moves through books, companions, cities, puzzles and discoveries.",
    icon: managedAssetUrl("feature.icon.09"),
    image: managedAssetUrl("feature.unique-and-powerful-story"),
    tagline: "A story designed to be lived through, not merely clicked through.",
    detail: "Echoes is a long-form narrative built around discovery, consequence, books, places, people and mysteries that connect over time. Different players can encounter information in different orders and build different understandings of the same larger story.",
    playerChange: "The story should reward attention months later, not just the next button press.",
    practice: ["Long-form structure", "Multiple stories and branching paths", "Recurring people, places and mysteries", "Discovery changes interpretation"],
  },
] as const;

export const inviteConsent = "I agree to be contacted by email.";
