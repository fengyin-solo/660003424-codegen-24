<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <div class="flex items-center justify-between mb-3 cursor-pointer select-none" @click="collapsed = !collapsed">
      <div class="flex items-center gap-2">
        <span class="text-cyan-400">🔬</span>
        <h3 class="text-sm font-bold text-slate-300">研究摘要</h3>
        <span class="text-xs text-slate-500">由当前筛选结果自动生成</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
          {{ summary ? summary.total : 0 }} 组词根
        </span>
      </div>
      <div class="flex items-center gap-3">
        <div class="hidden sm:flex gap-1.5 text-[10px]">
          <span v-if="familyLabel !== '全部'" class="px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-800">语系：{{ familyLabel }}</span>
          <span v-if="store.searchQuery" class="px-1.5 py-0.5 rounded bg-cyan-900/50 text-cyan-300 border border-cyan-800">关键词：{{ store.searchQuery }}</span>
        </div>
        <span class="text-slate-500 text-xs transition-transform" :class="{ 'rotate-180': !collapsed }">▾</span>
      </div>
    </div>

    <div v-show="!collapsed">
      <!-- 空结果 -->
      <div v-if="!summary" class="py-10 text-center text-sm text-slate-500">
        当前筛选条件下没有可分析的词根，请调整关键词或语系筛选。
      </div>

      <div v-else class="space-y-4">
        <!-- 指标卡 -->
        <div class="grid grid-cols-3 gap-3">
          <div class="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <div class="text-2xl font-bold text-cyan-400">{{ summary.total }}</div>
            <div class="text-xs text-slate-500 mt-0.5">可重建词根</div>
          </div>
          <div class="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <div class="text-2xl font-bold text-green-400">{{ summary.avgCoverage.toFixed(1) }}<span class="text-sm text-slate-500">/6</span></div>
            <div class="text-xs text-slate-500 mt-0.5">平均语言覆盖</div>
          </div>
          <div class="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <div class="text-2xl font-bold text-amber-400">{{ summary.fullChainCount }}</div>
            <div class="text-xs text-slate-500 mt-0.5">六语全证据链</div>
          </div>
        </div>

        <div class="grid lg:grid-cols-2 gap-4">
          <!-- 演化结论 -->
          <div>
            <h4 class="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
              <span class="w-1 h-3 bg-cyan-500 rounded-full"></span>演化结论
            </h4>
            <ol class="space-y-2">
              <li v-for="(c, i) in summary.conclusions" :key="i"
                  class="bg-slate-900 rounded-lg p-3 border-l-2"
                  :class="TONE_BORDER[c.tone]">
                <div class="flex items-start gap-2">
                  <span class="text-[10px] font-mono mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">{{ i + 1 }}</span>
                  <div>
                    <div class="text-xs font-bold text-slate-200 leading-relaxed">{{ c.title }}</div>
                    <div class="text-xs text-slate-400 mt-1 leading-relaxed">{{ c.detail }}</div>
                  </div>
                </div>
              </li>
            </ol>
          </div>

          <!-- 关键样本 -->
          <div>
            <h4 class="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
              <span class="w-1 h-3 bg-amber-500 rounded-full"></span>关键样本
            </h4>
            <div class="space-y-2">
              <div v-for="s in summary.keySamples" :key="s.root"
                   class="bg-slate-900 rounded-lg p-3 border border-slate-700">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-sm font-bold text-slate-100">{{ s.root }}</span>
                    <span class="text-xs text-slate-500">{{ s.meaning }}</span>
                  </div>
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full"
                        :class="TONE_BADGE[s.tone]">{{ s.tag }}</span>
                </div>
                <!-- 语言链 -->
                <div class="flex flex-wrap gap-x-2 gap-y-1 my-2 text-[11px] font-mono">
                  <span v-for="item in s.chain" :key="item.language" class="flex items-center gap-1"
                        :class="item.word ? 'opacity-100' : 'opacity-25 line-through'">
                    <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: CHAIN_COLORS[item.language] }"></span>
                    <span class="text-slate-500">{{ item.language }}</span>
                    <span :style="{ color: CHAIN_COLORS[item.language] }">{{ item.word ?? '—' }}</span>
                  </span>
                </div>
                <p class="text-[11px] text-slate-400 leading-relaxed">{{ s.note }}</p>
              </div>
            </div>

            <!-- 语言覆盖统计 -->
            <h4 class="text-xs font-bold text-slate-400 mt-3 mb-2 flex items-center gap-1.5">
              <span class="w-1 h-3 bg-green-500 rounded-full"></span>语言覆盖
            </h4>
            <div class="bg-slate-900 rounded-lg p-3 border border-slate-700 space-y-1.5">
              <div v-for="lp in summary.languagePresence" :key="lp.language" class="flex items-center gap-2 text-[11px]">
                <span class="w-12 text-slate-400 flex-shrink-0">{{ lp.language }}</span>
                <div class="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all"
                       :style="{ width: (lp.ratio * 100) + '%', backgroundColor: CHAIN_COLORS[lp.language] }"></div>
                </div>
                <span class="w-12 text-right text-slate-500 font-mono">{{ lp.count }}/{{ summary.total }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEtymologyStore, LANGUAGE_FAMILIES } from '../store/etymology'
import type { Tone } from '../utils/summary'

const store = useEtymologyStore()
const collapsed = ref(false)

const summary = computed(() => store.researchSummary)

const familyLabel = computed(() => {
  if (store.selectedFamily === 'all') return '全部'
  return LANGUAGE_FAMILIES.find(f => f.id === store.selectedFamily)?.name ?? store.selectedFamily
})

const TONE_BORDER: Record<Tone, string> = {
  cyan: 'border-cyan-500',
  green: 'border-green-500',
  amber: 'border-amber-500',
  purple: 'border-purple-500',
  blue: 'border-blue-500',
  rose: 'border-rose-500',
}

const TONE_BADGE: Record<Tone, string> = {
  cyan: 'bg-cyan-900/50 text-cyan-300 border border-cyan-800',
  green: 'bg-green-900/50 text-green-300 border border-green-800',
  amber: 'bg-amber-900/50 text-amber-300 border border-amber-800',
  purple: 'bg-purple-900/50 text-purple-300 border border-purple-800',
  blue: 'bg-blue-900/50 text-blue-300 border border-blue-800',
  rose: 'bg-rose-900/50 text-rose-300 border border-rose-800',
}

const CHAIN_COLORS: Record<string, string> = {
  '英语': '#22d3ee',
  '法语': '#60a5fa',
  '德语': '#4ade80',
  '西班牙语': '#fb923c',
  '俄语': '#c084fc',
  '拉丁语': '#facc15',
}
</script>
