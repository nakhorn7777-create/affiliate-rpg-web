import type { Lang } from "@/lib/lang/use-lang";

export const landingTranslations = {
  th: {
    hero: {
      title: "AffiliateRPG",
      subtitle1: "แอฟฟิลิเอตของคุณ กำลังจะกลายเป็นการผจญภัย",
      subtitle2:
        "โปรไฟล์นักสร้างคอนเทนต์ที่เก็บเลเวลได้จริง ปลดล็อกไทเทิล แข่งอันดับทุกซีซั่น",
      cta: "เข้าสู่แผนที่โลก",
    },
    why: {
      eyebrow: "PURPOSE",
      heading: "ทำไมต้อง AffiliateRPG",
      subheading:
        "ทุกลิงก์ที่แชร์ ทุกคนที่ติดตาม ไม่ควรเป็นแค่ตัวเลขที่หายไปวันพรุ่งนี้",
      body: "เราเชื่อว่าคนสร้างคอนเทนต์ควรมีพื้นที่ที่ผลงานของพวกเขา ‘เติบโต’ ได้จริง เหมือนตัวละครในเกม ไม่ใช่แค่โปรไฟล์นิ่งๆ ที่มีแต่ลิงก์ — ทุก follower คือ token ทุกซีซั่นคือบทใหม่ของการผจญภัย",
    },
    who: {
      eyebrow: "AUDIENCE",
      heading: "สร้างมาเพื่อใคร",
      subheading:
        "สำหรับนักสร้างคอนเทนต์ นักรีวิว และแอฟฟิลิเอต ที่อยากให้ตัวตนออนไลน์มีชีวิตมากกว่าลิงก์ในไบโอ",
      body: "ไม่ว่าจะเพิ่งเริ่มหรือมีผู้ติดตามอยู่แล้ว ที่นี่คือสนามที่ทุกความพยายามถูกแปลงเป็นความก้าวหน้าที่จับต้องได้",
    },
    gameplay: {
      eyebrow: "MECHANICS",
      heading: "โลกที่ไม่เคยหยุดนิ่ง",
      subheading:
        "สะสมทรัพยากรจากการเป็นแอฟฟิลิเอต นำมาคราฟต์ไอเทม ขายในตลาดกลาง แล้วไต่อันดับก่อนซีซั่นจะจบ",
      craftingLabel: "CRAFTING",
      craftingBody: "เก็บวัตถุดิบ ผสมสูตร สร้างไอเทมที่มีมูลค่าในตลาด",
      seasonLabel: "SEASON",
      seasonBody: "ทุกซีซั่นเริ่มใหม่เท่าเทียมกัน ใครจะไต่ขึ้นไปเป็นที่ 1 ในรอบนี้",
    },
    hallOfFame: {
      eyebrow: "LEGACY",
      heading: "บอร์ดเกียรติยศ",
      subheading: "ทุกซีซั่นจบลง ชื่อของผู้ชนะจะถูกจารึกไว้ตลอดกาล",
      seasonLabel: (n: number) => `ซีซั่น ${n}`,
      rankLabel: (n: number) => `อันดับ ${n}`,
      empty: "รอบแรกกำลังจะเริ่ม — ชื่อคุณอาจเป็นชื่อแรกบนบอร์ดนี้ก็ได้",
    },
    closing: {
      heading: "พร้อมเริ่มบทแรกของคุณหรือยัง",
      cta: "เข้าสู่ระบบ",
    },
    langSwitchLabel: "ภาษา",
  },
  en: {
    hero: {
      title: "AffiliateRPG",
      subtitle1: "Your affiliate profile is about to become an adventure",
      subtitle2:
        "A creator profile that actually levels up — unlock titles, compete every season",
      cta: "Enter the map",
    },
    why: {
      eyebrow: "PURPOSE",
      heading: "Why AffiliateRPG",
      subheading:
        "Every link you share, every follower you earn, shouldn't be a number that vanishes tomorrow",
      body: "We believe creators deserve a space where their work actually grows — like a character in a game, not a static profile that's just a list of links. Every follower is a token. Every season is a new chapter of the journey.",
    },
    who: {
      eyebrow: "AUDIENCE",
      heading: "Built for who",
      subheading:
        "For creators, reviewers, and affiliates who want their online identity to be more than a link in a bio",
      body: "Whether you're just starting out or already have an audience, this is the field where every effort converts into progress you can actually see.",
    },
    gameplay: {
      eyebrow: "MECHANICS",
      heading: "A world that never stands still",
      subheading:
        "Earn resources from affiliate activity, craft them into items, sell on the marketplace, and climb the ranks before the season ends",
      craftingLabel: "CRAFTING",
      craftingBody: "Gather materials, mix recipes, forge items with real market value",
      seasonLabel: "SEASON",
      seasonBody: "Every season starts equal — who climbs to #1 this round?",
    },
    hallOfFame: {
      eyebrow: "LEGACY",
      heading: "Hall of Fame",
      subheading: "When a season ends, the champions' names are carved in for good",
      seasonLabel: (n: number) => `Season ${n}`,
      rankLabel: (n: number) => `Rank ${n}`,
      empty: "The first season is about to begin — your name could be the first on this board.",
    },
    closing: {
      heading: "Ready to start your first chapter?",
      cta: "Sign in",
    },
    langSwitchLabel: "Language",
  },
} as const;

export type LandingTranslation = (typeof landingTranslations)[Lang];
