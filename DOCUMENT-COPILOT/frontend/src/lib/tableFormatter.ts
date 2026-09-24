/**
 * tableFormatter.ts
 * Utility to format filing passages and detect/extract markdown tables.
 */

export interface FormattedPassage {
  normalizedMarkdown: string
  extractedTableMarkdown: string | null
  hasTable: boolean
}

export function formatFilingPassage(content: string): FormattedPassage {
  if (!content) {
    return {
      normalizedMarkdown: '',
      extractedTableMarkdown: null,
      hasTable: false,
    }
  }

  // Check if content contains markdown table pattern (| ... | ... |)
  const lines = content.split('\n')
  const tableLines: string[] = []
  let isTable = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      isTable = true
      tableLines.push(trimmed)
    } else if (isTable && trimmed === '') {
      break
    }
  }

  const hasTable = tableLines.length >= 2
  const extractedTableMarkdown = hasTable ? tableLines.join('\n') : null

  return {
    normalizedMarkdown: content,
    extractedTableMarkdown,
    hasTable,
  }
}
