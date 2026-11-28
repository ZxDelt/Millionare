/**
 * AI host dialogue (GDD §7). Original lines only — no catchphrases from existing shows.
 * Variables: {name} {letter} {option} {coins} {level} {next}
 */
export type HostState =
  | "intro"
  | "firstQuestion"
  | "askQuestion"
  | "bigQuestion"
  | "reconfirm"
  | "finalAnswer"
  | "cancelled"
  | "reconfirmTimeout"
  | "suspense"
  | "correct"
  | "correctBig"
  | "wrong"
  | "timeout"
  | "timerLow"
  | "walkAway"
  | "win"
  | "doubleChanceOn"
  | "doubleChanceMiss"
  | "phoneFriend"
  | "phoneDone"
  | "askAi"
  | "walkAwayUnlocked";

export const HOST_LINES: Record<HostState, string[]> = {
  intro: [
    "Ladies and gentlemen, welcome to JOULE JACKPOT! Tonight, {name} is in the hot seat!",
    "The lights are on, the crowd is charged, and {name} is ready. Welcome to JOULE JACKPOT!",
    "Power up, everybody! {name}, welcome to the show where knowledge is energy!",
    "Welcome to JOULE JACKPOT! Sixteen questions stand between {name} and one hundred million Image Coins.",
  ],
  firstQuestion: [
    "Let's warm up the generators. Question one, for {coins} Image Coins.",
    "Here we go, {name}. Your first question, worth {coins} Image Coins.",
    "Deep breath. Question one is on the board.",
  ],
  askQuestion: [
    "Question {level}, for {coins} Image Coins.",
    "Here comes question {level}. {coins} Image Coins on the line.",
    "On to question {level}, {name}. This one is worth {coins}.",
    "Question {level}. Let's see what you've got.",
    "The meter keeps climbing. Question {level}, for {coins}.",
  ],
  bigQuestion: [
    "Now we're in high-voltage territory. Question {level}, for {coins} Image Coins.",
    "The crowd is silent. Question {level}, worth {coins} Image Coins.",
    "This is where legends are made, {name}. Question {level}.",
  ],
  reconfirm: [
    "{letter}: {option}. Is that your answer? Shall we lock it?",
    "You've picked {letter}. Are you sure, {name}?",
    "{option}... interesting. Do we lock in {letter}?",
    "{letter}, {option}. Final? Say the word and I'll lock it.",
  ],
  finalAnswer: [
    "No more second thoughts. Final answer then!",
    "Your next pick locks straight away, {name}. Choose wisely.",
  ],
  cancelled: [
    "No problem. Take another look.",
    "Changed your mind? The clock is running again.",
    "Fine, let's think again.",
  ],
  reconfirmTimeout: [
    "No answer? I'll take that as a no. The clock is running.",
  ],
  suspense: [
    "Locked in. Let's see if that's right...",
    "{letter} is locked. The whole studio is holding its breath...",
    "This is the moment...",
    "Let's find out...",
  ],
  correct: [
    "That is CORRECT! {coins} Image Coins!",
    "Absolutely right! You now have {coins} Image Coins!",
    "Yes! Spot on, {name}!",
    "Correct! The meter climbs to {coins}!",
  ],
  correctBig: [
    "UNBELIEVABLE! That's right! {coins} Image Coins!",
    "YES! {name}, you are on fire! {coins} Image Coins!",
  ],
  wrong: [
    "Oh no... that's not the right answer. The correct answer was {letter}: {option}.",
    "I'm so sorry, {name}. The answer was {letter}, {option}.",
    "That's not it. It was {letter}: {option}. What a game, though.",
  ],
  timeout: [
    "Time's up! I'm sorry, {name}. The answer was {letter}: {option}.",
    "The clock beat us this time. The answer was {letter}.",
  ],
  timerLow: [
    "Ten seconds left!",
    "The clock is running out, {name}!",
  ],
  walkAway: [
    "A smart decision! {name} walks away with {coins} Image Coins!",
    "Sometimes the bravest move is to stop. {coins} Image Coins, well played!",
  ],
  win: [
    "YOU'VE DONE IT! {name} has won the JOULE JACKPOT! One hundred million Image Coins!",
    "History tonight! {name} answers all five questions! JACKPOT!",
  ],
  doubleChanceOn: [
    "Double Chance is active! If your first pick is wrong, you get one more try.",
    "Two shots at this one, {name}. Make the first one count.",
  ],
  doubleChanceMiss: [
    "That's not it... but you still have one chance left!",
    "Wrong, but Double Chance saves you! Pick again from the remaining three.",
    "Not that one! Breathe. You've got one more shot.",
  ],
  phoneFriend: [
    "Time to phone a friend! You have {next} seconds. Make that call!",
    "Grab your phone, {name}. Your friend has {next} seconds starting now!",
  ],
  phoneDone: [
    "Time's up on the call. Did your friend help?",
    "Call over. Back to the board.",
  ],
  askAi: [
    "Hmm. My suggestion is {letter}: {option}... but honestly, the odds are 50-50.",
    "If I had to choose, I'd say {letter}. But my odds are 50-50, so it's your call.",
    "My circuits say {letter}, {option}. Odds? 50-50. Trust me at your own risk!",
  ],
  walkAwayUnlocked: [
    "From here on, you can walk away with what you've won. No timer now. Take your time.",
  ],
};

export function pickLine(state: HostState, vars: Record<string, string | number>, avoid?: string): string {
  const pool = HOST_LINES[state];
  let candidates = pool.filter((l) => l !== avoid);
  if (!candidates.length) candidates = pool;
  const tpl = candidates[Math.floor(Math.random() * candidates.length)];
  return fillLine(tpl, vars);
}

export function fillLine(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : ""));
}

/** Lines without player-specific variables: safe to pre-generate as voice clips. */
export function staticLines(): string[] {
  return Object.values(HOST_LINES)
    .flat()
    .filter((l) => !/\{\w+\}/.test(l));
}
