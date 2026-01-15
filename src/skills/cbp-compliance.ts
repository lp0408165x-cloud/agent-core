// ============================================
// Agent Core - CBP Compliance Skill
// ============================================

import type { Skill, SkillRule, SkillTemplate, SkillExample } from './types';

/**
 * CBP (U.S. Customs and Border Protection) Compliance Skill
 * 
 * 提供进口合规检查的专业知识和最佳实践
 */
export const cbpComplianceSkill: Skill = {
  id: 'cbp-compliance',
  name: 'CBP 合规检查',
  version: '1.0.0',
  category: 'compliance',
  description: '美国海关和边境保护局 (CBP) 进口合规检查专业技能',
  author: 'GTC Tech',

  // ==================== 核心知识 ====================
  systemPrompt: `# CBP 合规检查专家

你是一位专业的 CBP（美国海关和边境保护局）合规检查专家。你的任务是帮助检查进口文件的合规性，确保符合美国海关法规要求。

## 核心知识领域

### 1. HS 编码 (Harmonized System Code)
- HS 编码是国际通用的商品分类编码系统
- 美国使用 HTS (Harmonized Tariff Schedule) 10 位编码
- 前 6 位是国际通用，后 4 位是美国特定
- 编码错误会导致关税计算错误和合规问题

### 2. 原产地规则 (Country of Origin)
- 确定商品的"实质性转变"发生地
- 标记规则 (Marking Requirements): 商品必须标明原产国
- 优惠原产地：USMCA、GSP 等贸易协定的原产地要求
- 原产地证明文件必须准确完整

### 3. 估价规则 (Customs Valuation)
- 交易价格法为首选方法
- 包括：FOB 价格、运费、保险费、佣金等
- 关联交易需要特别审查
- Assist 价值必须申报

### 4. 必需文件
- 商业发票 (Commercial Invoice)
- 装箱单 (Packing List)
- 提单 (Bill of Lading / Airway Bill)
- 原产地证明 (Certificate of Origin)
- 进口许可证（如适用）

### 5. 特别关注项
- 反倾销/反补贴税 (AD/CVD)
- 301 条款关税
- 受限商品和禁运物品
- 知识产权 (IPR) 合规
- 强制劳动相关商品禁令

## 检查原则

1. **准确性**：所有信息必须准确一致
2. **完整性**：所有必需文件和字段必须齐全
3. **一致性**：各文件之间信息必须一致
4. **合规性**：必须符合当前法规要求
5. **时效性**：注意法规更新和有效期

## 常见问题清单

- HS 编码与商品描述不匹配
- 原产地标记缺失或错误
- 发票价值与申报价值不一致
- 缺少必需的许可证或证书
- 供应商/制造商信息不完整
- 重量/数量与装箱单不符`,

  // ==================== 任务模板 ====================
  templates: [
    {
      id: 'full-check',
      name: '完整合规检查',
      description: '对进口文件进行全面合规检查',
      prompt: `请对以下进口文件进行完整的 CBP 合规检查：

{{documents}}

检查要点：
1. HS 编码准确性
2. 原产地信息
3. 估价合理性
4. 文件完整性
5. 信息一致性

请输出：
- 发现的问题列表（按严重程度排序）
- 每个问题的详细说明
- 修正建议
- 合规评分（1-100）`,
      variables: [
        { name: 'documents', type: 'string', required: true, description: '进口文件内容' }
      ],
      outputFormat: 'markdown'
    },
    {
      id: 'hs-code-verify',
      name: 'HS 编码验证',
      description: '验证 HS 编码是否与商品描述匹配',
      prompt: `请验证以下商品的 HS 编码是否正确：

商品描述：{{description}}
当前 HS 编码：{{hsCode}}
原产国：{{country}}

请：
1. 分析商品特征
2. 确认正确的 HS 编码
3. 如有错误，说明正确编码和理由
4. 提供相关关税率信息`,
      variables: [
        { name: 'description', type: 'string', required: true, description: '商品描述' },
        { name: 'hsCode', type: 'string', required: true, description: '当前 HS 编码' },
        { name: 'country', type: 'string', required: true, description: '原产国' }
      ],
      outputFormat: 'markdown'
    },
    {
      id: 'origin-check',
      name: '原产地审核',
      description: '审核原产地证明和标记合规性',
      prompt: `请审核以下原产地信息：

产品：{{product}}
声明原产地：{{declaredOrigin}}
制造商：{{manufacturer}}
供应链信息：{{supplyChain}}

检查要点：
1. 原产地声明是否合理
2. 是否符合实质性转变规则
3. 原产地证明文件是否完整
4. 标记要求是否满足
5. 是否适用优惠关税`,
      variables: [
        { name: 'product', type: 'string', required: true, description: '产品名称' },
        { name: 'declaredOrigin', type: 'string', required: true, description: '声明原产地' },
        { name: 'manufacturer', type: 'string', required: false, description: '制造商信息' },
        { name: 'supplyChain', type: 'string', required: false, description: '供应链信息' }
      ],
      outputFormat: 'markdown'
    },
    {
      id: 'value-audit',
      name: '估价审核',
      description: '审核进口货物的海关估价',
      prompt: `请审核以下进口货物的海关估价：

商品：{{product}}
发票价格：{{invoiceValue}}
运费：{{freight}}
保险：{{insurance}}
其他费用：{{otherCharges}}
关联交易：{{relatedParty}}

请检查：
1. 交易价格是否合理
2. 是否包含所有应税费用
3. 关联交易估价是否合规
4. 是否存在 Assist 价值
5. 建议申报价值`,
      variables: [
        { name: 'product', type: 'string', required: true, description: '商品描述' },
        { name: 'invoiceValue', type: 'string', required: true, description: '发票价格' },
        { name: 'freight', type: 'string', required: false, description: '运费' },
        { name: 'insurance', type: 'string', required: false, description: '保险费' },
        { name: 'otherCharges', type: 'string', required: false, description: '其他费用' },
        { name: 'relatedParty', type: 'string', required: false, description: '是否关联交易' }
      ],
      outputFormat: 'markdown'
    }
  ],

  // ==================== 验证规则 ====================
  rules: [
    {
      id: 'hs-code-format',
      name: 'HS 编码格式',
      description: 'HTS 编码必须是 10 位数字',
      validate: (value) => /^\d{10}$/.test(String(value)),
      severity: 'error',
      message: 'HS 编码格式错误，必须是 10 位数字'
    },
    {
      id: 'country-code',
      name: '国家代码',
      description: '原产国必须使用有效的 ISO 国家代码',
      validate: (value) => /^[A-Z]{2}$/.test(String(value).toUpperCase()),
      severity: 'error',
      message: '国家代码格式错误，必须是 2 位字母（ISO 3166-1 alpha-2）'
    },
    {
      id: 'value-positive',
      name: '价值为正数',
      description: '申报价值必须大于零',
      validate: (value) => Number(value) > 0,
      severity: 'error',
      message: '申报价值必须大于零'
    },
    {
      id: 'invoice-number',
      name: '发票号',
      description: '发票号不能为空',
      validate: (value) => value && String(value).trim().length > 0,
      severity: 'error',
      message: '发票号不能为空'
    },
    {
      id: 'weight-positive',
      name: '重量为正数',
      description: '货物重量必须大于零',
      validate: (value) => Number(value) > 0,
      severity: 'warning',
      message: '货物重量应该大于零'
    },
    {
      id: 'manufacturer-info',
      name: '制造商信息',
      description: '制造商信息应该完整',
      validate: (value) => value && String(value).trim().length >= 5,
      severity: 'warning',
      message: '制造商信息不完整，可能影响合规审查'
    }
  ],

  // ==================== 示例 ====================
  examples: [
    {
      title: 'HS 编码检查示例',
      input: '商品：棉质男士 T 恤，100% 棉，针织，原产地越南，HS 编码：6109100012',
      output: `## HS 编码验证结果

✅ **编码正确**

- 商品类别：针织或钩编的 T 恤、汗衫及其他背心
- 章节：61 - 针织或钩编的服装及衣着附件
- 税目：6109 - T 恤、汗衫及其他背心
- 子目：6109.10 - 棉制
- 美国附加码：0012 - 男式

**关税信息：**
- 基本税率：16.5%
- 越南适用税率：16.5%（非优惠国）

**合规建议：**
- 确保原产地证明文件齐全
- 注意纺织品配额要求`,
      explanation: '此示例展示如何验证服装类商品的 HS 编码，包括编码结构分析和关税信息'
    },
    {
      title: '原产地问题示例',
      input: '商品从中国采购，在越南进行简单包装后出口，声明原产地为越南',
      output: `## 原产地审核结果

⚠️ **存在风险**

**问题：**
简单包装不构成"实质性转变"，不能改变原产地。

**分析：**
- 商品在中国生产制造
- 越南仅进行包装作业
- 包装不属于实质性加工

**结论：**
原产地应为中国 (CN)，而非越南 (VN)

**风险提示：**
- 虚假原产地声明属于严重违规
- 可能面临罚款和货物扣押
- 需要缴纳正确的中国商品关税（可能包括 301 关税）

**建议：**
1. 更正原产地声明
2. 重新评估关税影响
3. 审查供应链合规性`,
	  explanation: '此示例展示如何识别原产地规避问题'
    }
  ]
};

export default cbpComplianceSkill;