import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Agent Core',
  description: 'TypeScript LLM Agent Framework for Task Automation',
  base: '/agent-core/',  // ← 新增
  ignoreDeadLinks: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/agent-core/logo.svg' }],  // ← 修改
  ],

  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: 'API', link: '/api/agent' },
      { text: '示例', link: '/examples/basic' },
      {
        text: '更多',
        items: [
          { text: 'GitHub', link: 'https://github.com/lp0408165x-cloud/agent-core' },  // ← 修改
          { text: 'npm', link: 'https://www.npmjs.com/package/@gtc-tech/agent-core' },  // ← 新增
          { text: 'Changelog', link: '/changelog' },
        ]
      }
    ],

    // ... sidebar 保持不变 ...

    socialLinks: [
      { icon: 'github', link: 'https://github.com/lp0408165x-cloud/agent-core' }  // ← 修改
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-2026 GTC Tech'  // ← 修改
    },

    // ... 其余保持不变 ...
  }
});
