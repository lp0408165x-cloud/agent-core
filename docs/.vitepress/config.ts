import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Agent Core',
  description: 'TypeScript LLM Agent Framework for Task Automation',
  
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
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
          { text: 'GitHub', link: 'https://github.com/anthropic/agent-core' },
          { text: 'Changelog', link: '/changelog' },
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '入门',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '核心概念', link: '/guide/concepts' },
            { text: '安装配置', link: '/guide/installation' },
          ]
        },
        {
          text: '功能',
          items: [
            { text: 'LLM 客户端', link: '/guide/llm-clients' },
            { text: '工具系统', link: '/guide/tools' },
            { text: '状态持久化', link: '/guide/persistence' },
            { text: '实时通信', link: '/guide/realtime' },
          ]
        },
        {
          text: '进阶',
          items: [
            { text: 'CLI 工具', link: '/guide/cli' },
            { text: 'React UI', link: '/guide/react-ui' },
            { text: '插件系统', link: '/guide/plugins' },
          ]
        }
      ],
      '/api/': [
        {
          text: '核心',
          items: [
            { text: 'Agent', link: '/api/agent' },
            { text: 'Planner', link: '/api/planner' },
            { text: 'Executor', link: '/api/executor' },
            { text: 'StateMachine', link: '/api/state-machine' },
          ]
        },
        {
          text: 'LLM',
          items: [
            { text: 'OpenAI', link: '/api/llm-openai' },
            { text: 'Anthropic', link: '/api/llm-anthropic' },
            { text: 'Gemini', link: '/api/llm-gemini' },
            { text: 'Mistral', link: '/api/llm-mistral' },
            { text: 'Ollama', link: '/api/llm-ollama' },
          ]
        },
        {
          text: '工具',
          items: [
            { text: 'ToolRegistry', link: '/api/tool-registry' },
            { text: '内置工具', link: '/api/built-in-tools' },
          ]
        },
        {
          text: '其他',
          items: [
            { text: '类型定义', link: '/api/types' },
            { text: '工具函数', link: '/api/utils' },
          ]
        }
      ],
      '/examples/': [
        {
          text: '示例',
          items: [
            { text: '基础用法', link: '/examples/basic' },
            { text: 'CBP 合规检查', link: '/examples/cbp-compliance' },
            { text: '多LLM切换', link: '/examples/multi-llm' },
            { text: 'WebSocket 实时', link: '/examples/websocket' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/anthropic/agent-core' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 Anthropic'
    },

    search: {
      provider: 'local'
    },

    outline: {
      level: [2, 3]
    }
  },

  markdown: {
    lineNumbers: true
  }
});
