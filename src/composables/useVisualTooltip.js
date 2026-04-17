import { ref, reactive } from 'vue'

export function useVisualTooltip() {
  const visualBodyRef = ref(null)
  const tooltip = reactive({ visible: false, title: '', body: '', style: {} })
  const activeAnnotated = ref(null)
  const _tooltipData = ref({})

  function setTooltipData(data) {
    _tooltipData.value = data
  }

  function showTooltip(el, clientX, clientY, tooltipData) {
    const key = el.dataset.key
    const data = tooltipData[key]
    if (!data) return
    tooltip.title = data.title
    tooltip.body = data.body
    activeAnnotated.value?.classList.remove('active')
    el.classList.add('active')
    activeAnnotated.value = el
    const tw = Math.min(320, window.innerWidth * 0.88)
    const th = 120
    let left = clientX - tw / 2
    let top = clientY - th - 16
    if (left < 8) left = 8
    if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8
    if (top < 8) top = clientY + 24
    if (top + th > window.innerHeight - 8) top = clientY - th - 8
    if (top < 8) top = 8
    tooltip.style = { left: left + 'px', top: top + 'px', maxWidth: tw + 'px' }
    tooltip.visible = true
  }

  function hideTooltip() {
    tooltip.visible = false
    activeAnnotated.value?.classList.remove('active')
    activeAnnotated.value = null
  }

  function onVisualClick(e, tooltipData) {
    const ann = e.target.closest?.('.annotated')
    if (ann) {
      activeAnnotated.value === ann ? hideTooltip() : showTooltip(ann, e.clientX, e.clientY, tooltipData)
      e.stopPropagation()
    } else {
      hideTooltip()
    }
  }

  // touchstart は passive: false が必要なので手動登録。tooltipDataは内部refで常に最新を参照
  function registerTouchHandler(el, tooltipData) {
    if (!el) return
    if (tooltipData) _tooltipData.value = tooltipData
    el.addEventListener('touchstart', (e) => {
      const ann = e.target.closest?.('.annotated')
      if (ann) {
        const t = e.touches[0]
        activeAnnotated.value === ann
          ? hideTooltip()
          : showTooltip(ann, t.clientX, t.clientY, _tooltipData.value)
        e.preventDefault()
        e.stopPropagation()
      } else {
        hideTooltip()
      }
    }, { passive: false })
  }

  return { visualBodyRef, tooltip, showTooltip, hideTooltip, onVisualClick, registerTouchHandler, setTooltipData }
}
