import { familyNow } from "@/lib/time";

// Starter set. Stage 2 moves quotes into the database so parents can add their own.
export const QUOTES: { text: string; source: string }[] = [
  { text: "I can do all things through Christ who strengthens me.", source: "Philippians 4:13" },
  { text: "Small daily improvements over time lead to stunning results.", source: "Robin Sharma" },
  { text: "Whatever you do, work at it with all your heart.", source: "Colossians 3:23" },
  { text: "It always seems impossible until it's done.", source: "Nelson Mandela" },
  { text: "Be strong and courageous. Do not be afraid.", source: "Joshua 1:9" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", source: "Robert Collier" },
  { text: "Let us not become weary in doing good.", source: "Galatians 6:9" },
  { text: "You don't have to be great to start, but you have to start to be great.", source: "Zig Ziglar" },
  { text: "For I know the plans I have for you, plans to give you hope and a future.", source: "Jeremiah 29:11" },
  { text: "Discipline is choosing between what you want now and what you want most.", source: "Abraham Lincoln (attributed)" },
  { text: "Commit to the Lord whatever you do, and he will establish your plans.", source: "Proverbs 16:3" },
  { text: "The secret of getting ahead is getting started.", source: "Mark Twain (attributed)" },
];

// Same quote for the whole family all day; changes at midnight.
export function quoteOfTheDay(date = new Date()) {
  const { year, month, day } = familyNow(date);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  return QUOTES[dayNumber % QUOTES.length];
}
