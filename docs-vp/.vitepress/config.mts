import { defineConfig } from "vitepress";

export default defineConfig({
  // Project Pages site: https://manojmallick.github.io/skillweave/
  // Change to "/" if you later attach a custom domain (CNAME).
  base: "/skillweave/",
  title: "SkillWeave",
  description:
    "A runtime — and emerging open standard — for composing LLM tasks from small, focused, testable micro-skills.",

  appearance: "dark",

  head: [
    ["meta", { property: "og:site_name", content: "SkillWeave" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
  ],

  themeConfig: {
    siteTitle: "skillweave",
    nav: [
      { text: "Docs", link: "/guide/quick-start", activeMatch: "/guide/" },
      { text: "Roadmap", link: "/guide/roadmap" },
      { text: "GitHub", link: "https://github.com/manojmallick/skillweave" },
    ],

    sidebar: [
      {
        text: "Getting started",
        items: [
          { text: "Quick start", link: "/guide/quick-start" },
          { text: "Architecture", link: "/guide/architecture" },
        ],
      },
      {
        text: "Concepts",
        items: [
          { text: "Primitives", link: "/guide/primitives" },
          { text: "Skill contract", link: "/guide/skill-contract" },
          { text: "Reliability layer", link: "/guide/reliability" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Multi-LLM providers", link: "/guide/providers" },
          { text: "SigMap adapters", link: "/guide/adapters" },
          { text: "SigMap verify", link: "/guide/sigmap-verify" },
          { text: "Schema governance", link: "/guide/schemas" },
          { text: "Security model", link: "/guide/security" },
          { text: "Skill registry", link: "/guide/registry" },
          { text: "Triggers & events", link: "/guide/triggers-events" },
          { text: "CLI", link: "/guide/cli" },
        ],
      },
      {
        text: "More",
        items: [{ text: "Roadmap", link: "/guide/roadmap" }],
      },
    ],

    search: { provider: "local" },

    socialLinks: [{ icon: "github", link: "https://github.com/manojmallick/skillweave" }],

    footer: {
      message: "MIT License",
      copyright:
        'Copyright © 2026 <a href="https://github.com/manojmallick" target="_blank" rel="noopener">Manoj Mallick</a> · Made in Amsterdam 🇳🇱',
    },

    editLink: {
      pattern: "https://github.com/manojmallick/skillweave/edit/main/docs-vp/:path",
      text: "Edit this page on GitHub",
    },
  },
});
