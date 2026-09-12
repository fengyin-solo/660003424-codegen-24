import type { CognateSet } from '../types'
import { LANGUAGE_FAMILIES } from '../mock/data'

/** 对照表的标准语言列顺序 */
export const CHAIN_LANGUAGES = ['英语', '法语', '德语', '西班牙语', '俄语', '拉丁语'] as const

export type Tone = 'cyan' | 'green' | 'amber' | 'purple' | 'blue' | 'rose'

export interface Conclusion {
  title: string
  detail: string
  tone: Tone
}

export interface KeySample {
  root: string
  meaning: string
  tag: string
  tone: Tone
  note: string
  coverage: number
  chain: { language: string; word: string | null }[]
}

export interface LanguagePresence {
  language: string
  count: number
  ratio: number
}

export interface DomainStat {
  name: string
  count: number
}

export interface FamilyStat {
  name: string
  color: string
  count: number
}

export interface ResearchSummary {
  total: number
  avgCoverage: number
  fullChainCount: number
  familyStats: FamilyStat[]
  languagePresence: LanguagePresence[]
  domains: DomainStat[]
  conclusions: Conclusion[]
  keySamples: KeySample[]
}

/** 语义域关键词（按含义字段匹配） */
const DOMAIN_KEYWORDS: [string, string[]][] = [
  ['亲属关系', ['母亲', '父亲', '女人']],
  ['身体部位', ['脚', '足', '眼睛']],
  ['自然天象', ['水', '太阳', '光', '夜晚']],
  ['居食生存', ['家', '吃']],
  ['动物', ['鹰']],
  ['动作与认知', ['切割', '知道']],
]

/** 去掉长音符号等附加符号，便于跨语言比较词形 */
function normalize(w: string): string {
  return w.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[*₁₂₃ʷʰ]/g, '').toLowerCase()
}
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)] as number[])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
  }
  return dp[m][n]
}

/** 0~1 的词形相似度 */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const na = normalize(a), nb = normalize(b)
  return 1 - levenshtein(na, nb) / Math.max(na.length, nb.length)
}

function coverage(cs: CognateSet): number {
  return CHAIN_LANGUAGES.filter(lang => cs.languages[lang]).length
}

function chainOf(cs: CognateSet) {
  return CHAIN_LANGUAGES.map(language => ({
    language,
    word: cs.languages[language] || null,
  }))
}

function familyName(id: string): { name: string; color: string } {
  const f = LANGUAGE_FAMILIES.find(x => x.id === id)
  return { name: f?.name ?? id, color: f?.color ?? '#64748b' }
}

interface GrimmHit {
  cs: CognateSet
  shift: string
}

/** 格林定律：PIE 清塞音在日耳曼语中变为擦音/塞擦音，而拉丁语保留原读 */
function findGrimmHits(sets: CognateSet[]): GrimmHit[] {
  const hits: GrimmHit[] = []
  for (const cs of sets) {
    const en = normalize(cs.languages['英语'] ?? '')
    const la = normalize(cs.languages['拉丁语'] ?? '')
    const root = normalize(cs.root)
    if (!en || !la || !root) continue
    if (root.startsWith('p') && en.startsWith('f') && la.startsWith('p')) hits.push({ cs, shift: 'p→f' })
    else if (root.startsWith('t') && en.startsWith('th') && la.startsWith('t')) hits.push({ cs, shift: 't→θ' })
    else if (root.includes('sk') && en.startsWith('sh') && la.startsWith('sc')) hits.push({ cs, shift: 'sk→ʃ' })
    else if (root.includes('k') && (en.startsWith('h') || en.startsWith('sh')) && la.startsWith('c')) hits.push({ cs, shift: 'k→h' })
  }
  return hits
}

function buildKeySamples(sets: CognateSet[], grimm: GrimmHit[]): KeySample[] {
  const samples: KeySample[] = []
  const used = new Set<string>()
  const CHAIN_LEN = CHAIN_LANGUAGES.length
  /** 从候选中选取第一个未占用的词根 */
  const pick = (...candidates: (CognateSet | undefined)[]) =>
    candidates.find(cs => cs && !used.has(cs.root))

  const add = (cs: CognateSet | undefined, tag: string, tone: Tone, note: string) => {
    if (!cs || used.has(cs.root) || samples.length >= 4) return
    used.add(cs.root)
    samples.push({ root: cs.root, meaning: cs.meaning, tag, tone, note, coverage: coverage(cs), chain: chainOf(cs) })
  }

  // 1. 格林定律首选 p→f 案例（foot/father 链证据最完整）
  const grimmSample = grimm.find(h => h.shift === 'p→f') ?? grimm[0]
  add(
    grimmSample?.cs,
    `格林定律 · ${grimmSample?.shift ?? '辅音转移'}`, 'cyan',
    grimmSample
      ? `PIE ${grimmSample.cs.root} 的清塞音在日耳曼语中转移：英语 ${grimmSample.cs.languages['英语']}，而拉丁语保留早期读形 ${grimmSample.cs.languages['拉丁语']}，可直接对照验证音变定律。`
      : '原始印欧语清塞音在日耳曼语中系统转移，而拉丁语保留原读，可据此区分直系传承词与后期借词。',
  )

  // 2. 覆盖语种最多的词根
  const byCoverage = [...sets].sort((a, b) => {
    const diff = coverage(b) - coverage(a)
    if (diff) return diff
    return a.meaning.includes('母') ? -1 : 1
  })
  const fullest = pick(...byCoverage)
  if (fullest) {
    const cov = coverage(fullest)
    add(
      fullest,
      cov === CHAIN_LEN ? '全语支证据链' : '覆盖最广证据', 'green',
      cov === CHAIN_LEN
        ? `${CHAIN_LEN} 种语言全部有同源例证，是该原始词根跨语支稳定传承的最强证据。`
        : `当前词根覆盖 ${cov}/${CHAIN_LEN} 种语言，是本筛选集合中跨语支证据最完整的样本。`,
    )
  }

  // 3. 罗曼语继承链（西语词形保守、法语语音侵蚀）
  const romanceCandidates = sets
    .filter(cs => cs.languages['拉丁语'] && (cs.languages['西班牙语'] || cs.languages['法语']))
    .sort((a, b) => {
      const score = (c: CognateSet) =>
        similarity(c.languages['西班牙语'] ?? '', c.languages['拉丁语'] ?? '') +
        similarity(c.languages['法语'] ?? '', c.languages['拉丁语'] ?? '')
      return score(b) - score(a)
    })
  const romance = pick(...romanceCandidates)
  if (romance) {
    const es = romance.languages['西班牙语'], fr = romance.languages['法语'], la = romance.languages['拉丁语']!
    const parts: string[] = [`拉丁语 ${la}`]
    if (es) parts.push(`西班牙语 ${es}（词形保守）`)
    if (fr) parts.push(`法语 ${fr}（词尾磨损）`)
    add(
      romance, '罗曼语继承', 'amber',
      `“${romance.meaning}”由 ${parts.join(' → ')}，可观察罗曼语分支从拉丁语通俗演化中的语音保守与磨损差异。`,
    )
  }

  // 4. 语义偏移或语支缺证案例
  const shifted = sets.find(cs => /女人|妻子/.test(cs.meaning) && /queen/i.test(cs.languages['英语'] ?? ''))
  const gap = sets.find(cs => cs.languages['拉丁语'] && !cs.languages['俄语'])
  const fourth = pick(shifted, gap, ...byCoverage)
  if (shifted && !used.has(shifted.root)) {
    add(shifted, '语义升格', 'purple', '同一词根“女人/妻子”在英语中升格为 queen（王后），而德语保留“女人”本义，是语义演变的典型样本。')
  } else if (gap && !used.has(gap.root)) {
    add(gap, '斯拉夫语支缺证', 'purple', `词根 ${gap.root} 在拉丁语支有例证而俄语缺证，反映词汇在语支分化中的替换与失落。`)
  } else if (fourth && !used.has(fourth.root)) {
    add(fourth, '待考词根', 'purple', `“${fourth.meaning}”的跨语支对应中仍有缺证语言，需借助更多文献与音变规则进一步考释。`)
  }

  return samples
}

export function buildResearchSummary(sets: CognateSet[]): ResearchSummary | null {
  if (!sets.length) return null

  const total = sets.length
  const coverages = sets.map(coverage)
  const avgCoverage = coverages.reduce((s, c) => s + c, 0) / total
  const fullChainCount = coverages.filter(c => c === CHAIN_LANGUAGES.length).length

  const familyMap = new Map<string, number>()
  for (const cs of sets) familyMap.set(cs.family, (familyMap.get(cs.family) ?? 0) + 1)
  const familyStats: FamilyStat[] = [...familyMap.entries()]
    .map(([id, count]) => ({ ...familyName(id), count }))
    .sort((a, b) => b.count - a.count)

  const languagePresence: LanguagePresence[] = CHAIN_LANGUAGES.map(language => {
    const count = sets.filter(cs => cs.languages[language]).length
    return { language, count, ratio: count / total }
  })

  const domains: DomainStat[] = DOMAIN_KEYWORDS.map(([name, keys]) => ({
    name,
    count: sets.filter(cs => keys.some(k => cs.meaning.includes(k))).length,
  })).filter(d => d.count > 0).sort((a, b) => b.count - a.count)

  const conclusions: Conclusion[] = []
  const CHAIN_LEN = CHAIN_LANGUAGES.length

  // 结论 1：总体覆盖面
  const familyText = familyStats.map(f => `${f.name} ${f.count} 组`).join('、')
  conclusions.push({
    tone: 'blue',
    title: `当前集合包含 ${total} 个可重建词根，平均覆盖 ${avgCoverage.toFixed(1)}/${CHAIN_LEN} 种语言`,
    detail: `语系分布：${familyText}；其中 ${fullChainCount} 个词根在 ${CHAIN_LEN} 种语言中均有例证（占 ${Math.round(fullChainCount / total * 100)}%），${total >= 3 ? '说明基础核心词在印欧语系分化中保持了高度可追溯性' : '可作为进一步跨语支比较的起点'}。`,
  })

  // 结论 2：格林定律
  const grimm = findGrimmHits(sets)
  if (grimm.length) {
    const shifts = [...new Set(grimm.map(h => h.shift))]
    const examples = grimm.slice(0, 3)
      .map(h => `${h.cs.languages['拉丁语']} → ${h.cs.languages['英语']}`).join('，')
    conclusions.push({
      tone: 'cyan',
      title: `检出 ${grimm.length} 组符合格林定律的辅音转移（${shifts.join('、')}）`,
      detail: `原始印欧语清塞音进入原始日耳曼语后系统转移，而拉丁语保留早期读形：${examples}。这是区分日耳曼语支直系传承词与后期拉丁语借词的关键判据。`,
    })
  }

  // 结论 3：罗曼语支对拉丁语的继承与磨损（需要西语、法语均有足够样本）
  const withBothRomance = sets.filter(cs => cs.languages['拉丁语'] && cs.languages['法语'] && cs.languages['西班牙语'])
  if (withBothRomance.length >= 2) {
    const avg = (lang: '法语' | '西班牙语') =>
      withBothRomance.reduce((s, cs) => s + similarity(cs.languages[lang]!, cs.languages['拉丁语']!), 0) / withBothRomance.length
    const esSim = avg('西班牙语'), frSim = avg('法语')
    const esEx = [...withBothRomance].sort((a, b) =>
      similarity(b.languages['西班牙语']!, b.languages['拉丁语']!) - similarity(a.languages['西班牙语']!, a.languages['拉丁语']!))[0]
    const frEx = [...withBothRomance].sort((a, b) =>
      similarity(a.languages['法语']!, a.languages['拉丁语']!) - similarity(b.languages['法语']!, b.languages['拉丁语']!))[0]
    conclusions.push({
      tone: 'amber',
      title: `罗曼语支由拉丁语通俗演化：西语相似度 ${Math.round(esSim * 100)}%，法语 ${Math.round(frSim * 100)}%`,
      detail: `西班牙语词形普遍更保守（如 ${esEx.languages['拉丁语']}→${esEx.languages['西班牙语']}），法语经历更激进的元音演变与词尾脱落（如 ${frEx.languages['拉丁语']}→${frEx.languages['法语']}），二者均为通俗拉丁语的直系后代而非平行借词。`,
    })
  }

  // 结论 4：英语中的拉丁语借词层
  const loans = sets.filter(cs => {
    const en = cs.languages['英语'], la = cs.languages['拉丁语']
    return en && la && similarity(en, la) >= 0.85
  })
  if (loans.length) {
    // 在集合内部找一个经日耳曼音变的对照词，避免引用不在筛选结果中的例子
    const inherited = sets.find(cs => {
      const en = cs.languages['英语'], la = cs.languages['拉丁语']
      return en && la && similarity(en, la) < 0.5 && findGrimmHits([cs]).length > 0
    })
    const contrast = inherited
      ? `，与同集合中经日耳曼语支音变的 ${inherited.languages['拉丁语']}→${inherited.languages['英语']} 等本族词构成双词层`
      : '，与经日耳曼语支直系传承、经历过辅音转移的本族词构成双词层'
    conclusions.push({
      tone: 'rose',
      title: `识别出 ${loans.length} 个英语词项高度贴合拉丁词形，疑为文化借词层`,
      detail: `如 ${loans.slice(0, 3).map(c => `${c.languages['英语']}↔拉丁 ${c.languages['拉丁语']}`).join('，')}；这些词未经历格林定律音变${contrast}（learned/formal 词汇）。`,
    })
  }

  // 结论 5：东斯拉夫语支的分化与缺证（样本足够时才作统计性结论）
  const withLatin = sets.filter(cs => cs.languages['拉丁语'])
  const russianGaps = withLatin.filter(cs => !cs.languages['俄语'])
  if (withLatin.length >= 3) {
    conclusions.push({
      tone: 'purple',
      title: russianGaps.length
        ? `波罗的-斯拉夫语支独立演化：${russianGaps.length}/${withLatin.length} 个拉丁旁证词根在俄语缺证`
        : `俄语覆盖全部 ${withLatin.length} 个有拉丁旁证的词根，但走独立演化路径`,
      detail: russianGaps.length
        ? `如 ${russianGaps.slice(0, 2).map(c => c.root).join('、')} 在东斯拉夫语中被其他词根替换或未留下文献例证；已有俄语词形（西里尔字母）亦多来自独立的原始斯拉夫语续体，显示该语支分化时间较早。`
        : `俄语词形多以独立的斯拉夫语续体延续（西里尔字母体系），与拉丁词形构成远源对照而非直接继承。`,
    })
  }

  // 结论 6：语义域稳定性（至少 2 组词根才谈“语义域”）
  if (domains.length && domains[0].count >= 2) {
    const top = domains[0]
    const domainAvg = (name: string) => {
      const keys = DOMAIN_KEYWORDS.find(([n]) => n === name)?.[1] ?? []
      const inDomain = sets.filter(cs => keys.some(k => cs.meaning.includes(k)))
      return inDomain.reduce((s, cs) => s + coverage(cs), 0) / (inDomain.length || 1)
    }
    conclusions.push({
      tone: 'green',
      title: `“${top.name}”是当前样本中最大的语义域（${top.count} 组，平均覆盖 ${domainAvg(top.name).toFixed(1)} 种语言）`,
      detail: '亲属称谓、身体部位与自然天象等核心词跨语支覆盖率最高、词形对应最规则，符合核心基础词根（Swadesh 核心词）演化缓慢、最易被历史比较法重建的普遍规律。',
    })
  }

  return {
    total,
    avgCoverage,
    fullChainCount,
    familyStats,
    languagePresence,
    domains,
    conclusions,
    keySamples: buildKeySamples(sets, grimm),
  }
}
