import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightObsidian, { obsidianSidebarGroup } from 'starlight-obsidian';
import remarkMermaidjs from 'remark-mermaidjs';
// TODO: Re-enable once starlight-theme-obsidian resolves Astro v6 / Zod v4 compat
// import starlightThemeObsidian from 'starlight-theme-obsidian';

export default defineConfig({
  site: 'https://cybersader.github.io/obsidian-in-enterprise',
  base: '/obsidian-in-enterprise',
  markdown: {
    remarkPlugins: [remarkMermaidjs],
  },
  integrations: [
    starlight({
      title: 'Obsidian in Enterprise',
      description: 'Browser-based Obsidian with CRDT sync and enterprise access control',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/cybersader/obsidian-in-enterprise' },
      ],
      editLink: {
        baseUrl: 'https://github.com/cybersader/obsidian-in-enterprise/edit/main/docs-site/',
      },
      plugins: [
        // Import knowledge-base/ as an Obsidian vault
        starlightObsidian({
          vault: '../knowledge-base',
          output: 'knowledge-base',
          sidebar: {
            label: 'Knowledge Base',
            collapsed: false,
          },
          copyFrontmatter: 'all',
        }),
        // TODO: Re-enable Obsidian theme once Astro v6 compat resolved
        // starlightThemeObsidian(),
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'guides/introduction' },
            { label: 'Architecture', slug: 'guides/architecture' },
            { label: 'Quick Start', slug: 'guides/quickstart' },
          ],
        },
        {
          label: 'Contributing',
          items: [
            { label: 'How to Contribute', slug: 'contributing/how-to-contribute' },
            { label: 'Documentation Guide', slug: 'contributing/documentation-guide' },
          ],
        },
        // Auto-generated sidebar from knowledge-base vault
        obsidianSidebarGroup,
      ],
    }),
  ],
});
