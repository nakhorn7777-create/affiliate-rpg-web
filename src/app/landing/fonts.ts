import { Pixelify_Sans, Prompt, Taviraj } from "next/font/google";

export const pixelifySans = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600"],
});

export const taviraj = Taviraj({
  subsets: ["latin", "thai"],
  weight: ["500", "600", "700"],
});
