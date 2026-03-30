import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightObsidian, { obsidianSidebarGroup } from 'starlight-obsidian';
import remarkMermaidjs from 'remark-mermaidjs';
import wikiLinkPlugin from '@flowershow/remark-wiki-link';

export default defineConfig({
  site: 'https://docs.openclast.com',
  base: '/',
  markdown: {
    remarkPlugins: [
      remarkMermaidjs,
      [wikiLinkPlugin, {
        pathFormat: 'obsidian-short',
        wikiLinkClassName: 'internal-link',
        hrefTemplate: (permalink) => `/${permalink}/`,
      }],
    ],
  },
  integrations: [
    starlight({
      title: 'OpenClast',
      description: 'Browser-based Obsidian with CRDT sync and enterprise access control',
      customCss: ['./src/styles/openclast-theme.css'],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/cybersader/openclast' },
      ],
      editLink: {
        baseUrl: 'https://github.com/cybersader/openclast/edit/main/docs-site/',
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
