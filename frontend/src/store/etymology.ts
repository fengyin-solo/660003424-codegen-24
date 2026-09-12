import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { COGNATE_SETS, LANGUAGE_FAMILIES, buildGraph } from '../mock/data'
import { buildResearchSummary } from '../utils/summary'
export { LANGUAGE_FAMILIES, COGNATE_SETS }

export const useEtymologyStore = defineStore('etymology', () => {
  const graph = ref(buildGraph())
  const selectedNode = ref<any>(null)
  const searchQuery = ref('')
  const selectedFamily = ref('all')

  const filteredCognates = computed(() =>
    COGNATE_SETS.filter(cs => {
      const q = searchQuery.value.toLowerCase()
      const matchSearch = !q || cs.root.toLowerCase().includes(q) || cs.meaning.includes(q) || Object.values(cs.languages).some((w: string) => w.toLowerCase().includes(q))
      const matchFamily = selectedFamily.value === 'all' || cs.family === selectedFamily.value
      return matchSearch && matchFamily
    })
  )

  /** 由当前筛选结果自动生成的研究摘要（演化结论 + 关键样本） */
  const researchSummary = computed(() => buildResearchSummary(filteredCognates.value))

  return { graph, selectedNode, searchQuery, selectedFamily, filteredCognates, researchSummary }
})
