// ============================================
// Agent Core - Built-in Tools
// ============================================

import { ToolDefinition } from '../types';
import { createTool } from '../core/ToolRegistry';

// -------------------- File System Tools --------------------

export const fileReadTool: ToolDefinition = createTool()
  .name('file_read')
  .description('读取文件内容')
  .category('filesystem')
  .parameter({
    name: 'path',
    type: 'string',
    required: true,
    description: '文件路径'
  })
  .parameter({
    name: 'encoding',
    type: 'string',
    required: false,
    description: '文件编码',
    default: 'utf-8'
  })
  .returns('string')
  .execute(async (params) => {
    // In browser environment, this would use File API
    // In Node.js, this would use fs module
    if (typeof window !== 'undefined') {
      throw new Error('File read not supported in browser');
    }
    
    const fs = await import('fs').then(m => m.promises);
    return fs.readFile(params.path, { encoding: params.encoding as BufferEncoding });
  })
  .build();

export const fileWriteTool: ToolDefinition = createTool()
  .name('file_write')
  .description('写入文件内容')
  .category('filesystem')
  .parameter({
    name: 'path',
    type: 'string',
    required: true,
    description: '文件路径'
  })
  .parameter({
    name: 'content',
    type: 'string',
    required: true,
    description: '文件内容'
  })
  .parameter({
    name: 'encoding',
    type: 'string',
    required: false,
    description: '文件编码',
    default: 'utf-8'
  })
  .returns('boolean')
  .execute(async (params) => {
    if (typeof window !== 'undefined') {
      throw new Error('File write not supported in browser');
    }
    
    const fs = await import('fs').then(m => m.promises);
    await fs.writeFile(params.path, params.content, { encoding: params.encoding as BufferEncoding });
    return true;
  })
  .build();

export const fileListTool: ToolDefinition = createTool()
  .name('file_list')
  .description('列出目录中的文件')
  .category('filesystem')
  .parameter({
    name: 'path',
    type: 'string',
    required: true,
    description: '目录路径'
  })
  .parameter({
    name: 'recursive',
    type: 'boolean',
    required: false,
    description: '是否递归',
    default: false
  })
  .returns('array')
  .execute(async (params) => {
    if (typeof window !== 'undefined') {
      throw new Error('File list not supported in browser');
    }
    
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');
    
    const listDir = async (dir: string, recursive: boolean): Promise<string[]> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files: string[] = [];
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && recursive) {
          files.push(...await listDir(fullPath, recursive));
        } else {
          files.push(fullPath);
        }
      }
      
      return files;
    };
    
    return listDir(params.path, params.recursive);
  })
  .build();

// -------------------- Web Tools --------------------

export const webSearchTool: ToolDefinition = createTool()
  .name('web_search')
  .description('搜索网页信息')
  .category('web')
  .parameter({
    name: 'query',
    type: 'string',
    required: true,
    description: '搜索关键词'
  })
  .parameter({
    name: 'limit',
    type: 'number',
    required: false,
    description: '结果数量限制',
    default: 10
  })
  .returns('array')
  .execute(async (params, options) => {
    // Placeholder - would integrate with actual search API
    // e.g., Google Custom Search, Bing API, SerpAPI, etc.
    console.log(`[WebSearch] Searching for: ${params.query}`);
    
    // Simulated response
    return {
      query: params.query,
      results: [
        {
          title: `Search result for: ${params.query}`,
          url: 'https://example.com',
          snippet: 'This is a placeholder search result...'
        }
      ],
      totalResults: 1
    };
  })
  .build();

export const webFetchTool: ToolDefinition = createTool()
  .name('web_fetch')
  .description('获取网页内容')
  .category('web')
  .parameter({
    name: 'url',
    type: 'string',
    required: true,
    description: 'URL地址'
  })
  .parameter({
    name: 'method',
    type: 'string',
    required: false,
    description: 'HTTP方法',
    default: 'GET'
  })
  .parameter({
    name: 'headers',
    type: 'object',
    required: false,
    description: '请求头'
  })
  .parameter({
    name: 'body',
    type: 'string',
    required: false,
    description: '请求体'
  })
  .returns('object')
  .execute(async (params, options) => {
    const { url, method = 'GET', headers = {}, body } = params;
    
    const fetchOptions: RequestInit = {
      method,
      headers: headers as HeadersInit,
      signal: options?.signal
    };
    
    if (body && method !== 'GET') {
      fetchOptions.body = body;
    }
    
    const response = await fetch(url, fetchOptions);
    
    const contentType = response.headers.get('content-type') || '';
    let data: any;
    
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    // Convert headers to object (compatible with all environments)
    const headersObj: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    
    return {
      status: response.status,
      statusText: response.statusText,
      headers: headersObj,
      data
    };
  })
  .build();

// -------------------- Data Tools --------------------

export const jsonParseTool: ToolDefinition = createTool()
  .name('json_parse')
  .description('解析JSON字符串')
  .category('data')
  .parameter({
    name: 'text',
    type: 'string',
    required: true,
    description: 'JSON字符串'
  })
  .returns('object')
  .execute(async (params) => {
    return JSON.parse(params.text);
  })
  .build();

export const jsonStringifyTool: ToolDefinition = createTool()
  .name('json_stringify')
  .description('将对象转换为JSON字符串')
  .category('data')
  .parameter({
    name: 'data',
    type: 'object',
    required: true,
    description: '要转换的对象'
  })
  .parameter({
    name: 'pretty',
    type: 'boolean',
    required: false,
    description: '是否格式化',
    default: false
  })
  .returns('string')
  .execute(async (params) => {
    return JSON.stringify(params.data, null, params.pretty ? 2 : undefined);
  })
  .build();

export const csvParseTool: ToolDefinition = createTool()
  .name('csv_parse')
  .description('解析CSV数据')
  .category('data')
  .parameter({
    name: 'text',
    type: 'string',
    required: true,
    description: 'CSV文本'
  })
  .parameter({
    name: 'delimiter',
    type: 'string',
    required: false,
    description: '分隔符',
    default: ','
  })
  .parameter({
    name: 'hasHeader',
    type: 'boolean',
    required: false,
    description: '是否有表头',
    default: true
  })
  .returns('array')
  .execute(async (params) => {
    const { text, delimiter = ',', hasHeader = true } = params;
    const lines = text.trim().split('\n');
    
    if (lines.length === 0) return [];
    
    const parseRow = (row: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      result.push(current.trim());
      return result;
    };
    
    if (hasHeader) {
      const headers = parseRow(lines[0]);
      return lines.slice(1).map(line => {
        const values = parseRow(line);
        const obj: Record<string, string> = {};
        headers.forEach((header, i) => {
          obj[header] = values[i] || '';
        });
        return obj;
      });
    } else {
      return lines.map(line => parseRow(line));
    }
  })
  .build();

// -------------------- Text Tools --------------------

export const textExtractTool: ToolDefinition = createTool()
  .name('text_extract')
  .description('从文本中提取信息')
  .category('text')
  .parameter({
    name: 'text',
    type: 'string',
    required: true,
    description: '源文本'
  })
  .parameter({
    name: 'pattern',
    type: 'string',
    required: true,
    description: '正则表达式'
  })
  .parameter({
    name: 'global',
    type: 'boolean',
    required: false,
    description: '全局匹配',
    default: true
  })
  .returns('array')
  .execute(async (params) => {
    const flags = params.global ? 'g' : '';
    const regex = new RegExp(params.pattern, flags);
    const matches = params.text.match(regex);
    return matches || [];
  })
  .build();

export const textReplaceTool: ToolDefinition = createTool()
  .name('text_replace')
  .description('替换文本内容')
  .category('text')
  .parameter({
    name: 'text',
    type: 'string',
    required: true,
    description: '源文本'
  })
  .parameter({
    name: 'search',
    type: 'string',
    required: true,
    description: '搜索内容'
  })
  .parameter({
    name: 'replace',
    type: 'string',
    required: true,
    description: '替换内容'
  })
  .parameter({
    name: 'isRegex',
    type: 'boolean',
    required: false,
    description: '是否正则',
    default: false
  })
  .returns('string')
  .execute(async (params) => {
    if (params.isRegex) {
      const regex = new RegExp(params.search, 'g');
      return params.text.replace(regex, params.replace);
    }
    return params.text.split(params.search).join(params.replace);
  })
  .build();

// -------------------- Code Tools --------------------

export const codeExecuteTool: ToolDefinition = createTool()
  .name('code_execute')
  .description('执行JavaScript代码')
  .category('code')
  .parameter({
    name: 'code',
    type: 'string',
    required: true,
    description: '代码内容'
  })
  .parameter({
    name: 'context',
    type: 'object',
    required: false,
    description: '上下文变量'
  })
  .returns('any')
  .execute(async (params) => {
    // Warning: This is a simplified implementation
    // In production, use a proper sandbox (vm2, isolated-vm, etc.)
    const { code, context = {} } = params;
    
    const contextKeys = Object.keys(context);
    const contextValues = Object.values(context);
    
    const fn = new Function(...contextKeys, `
      "use strict";
      return (async () => {
        ${code}
      })();
    `);
    
    return fn(...contextValues);
  })
  .build();

// -------------------- Math Tools --------------------

export const mathEvaluateTool: ToolDefinition = createTool()
  .name('math_evaluate')
  .description('计算数学表达式')
  .category('math')
  .parameter({
    name: 'expression',
    type: 'string',
    required: true,
    description: '数学表达式'
  })
  .returns('number')
  .execute(async (params) => {
    // Simple safe math evaluation
    const safeExpression = params.expression.replace(/[^0-9+\-*/().%\s]/g, '');
    return new Function(`return ${safeExpression}`)();
  })
  .build();

// -------------------- DateTime Tools --------------------

export const datetimeFormatTool: ToolDefinition = createTool()
  .name('datetime_format')
  .description('格式化日期时间')
  .category('datetime')
  .parameter({
    name: 'timestamp',
    type: 'number',
    required: false,
    description: '时间戳（毫秒）'
  })
  .parameter({
    name: 'format',
    type: 'string',
    required: false,
    description: '格式字符串',
    default: 'YYYY-MM-DD HH:mm:ss'
  })
  .parameter({
    name: 'timezone',
    type: 'string',
    required: false,
    description: '时区'
  })
  .returns('string')
  .execute(async (params) => {
    const date = params.timestamp ? new Date(params.timestamp) : new Date();
    
    // Simple format implementation
    const format = params.format || 'YYYY-MM-DD HH:mm:ss';
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    return format
      .replace('YYYY', date.getFullYear().toString())
      .replace('MM', pad(date.getMonth() + 1))
      .replace('DD', pad(date.getDate()))
      .replace('HH', pad(date.getHours()))
      .replace('mm', pad(date.getMinutes()))
      .replace('ss', pad(date.getSeconds()));
  })
  .build();

// -------------------- Export All Tools --------------------

export const defaultTools: ToolDefinition[] = [
  // Filesystem
  fileReadTool,
  fileWriteTool,
  fileListTool,
  // Web
  webSearchTool,
  webFetchTool,
  // Data
  jsonParseTool,
  jsonStringifyTool,
  csvParseTool,
  // Text
  textExtractTool,
  textReplaceTool,
  // Code
  codeExecuteTool,
  // Math
  mathEvaluateTool,
  // DateTime
  datetimeFormatTool
];

export function getToolsByCategory(category: string): ToolDefinition[] {
  return defaultTools.filter(tool => tool.category === category);
}

export function getToolCategories(): string[] {
  return [...new Set(defaultTools.map(tool => tool.category))];
}
