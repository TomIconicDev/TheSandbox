const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify'

export function parseEmailAddress(fromHeader = '') {
  const match = fromHeader.match(/<([^>]+)>/)
  const email = (match ? match[1] : fromHeader).trim().toLowerCase()
  const name = fromHeader.replace(/<[^>]+>/g, '').replaceAll('"', '').trim()
  return {
    email: email || 'unknown',
    name: name || email || 'Unknown sender',
    raw: fromHeader || 'Unknown sender'
  }
}

export function getHeader(message, headerName) {
  const headers = message?.payload?.headers || []
  return headers.find(h => h.name.toLowerCase() === headerName.toLowerCase())?.value || ''
}

export async function gmailFetch(path, accessToken, options = {}) {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gmail API ${res.status}: ${text}`)
  }

  if (res.status === 204) return null
  return res.json()
}

export async function listMessageIds({ accessToken, query = '', maxMessages = 0, onProgress }) {
  let pageToken = ''
  const ids = []
  const safeQuery = query.trim()

  do {
    const params = new URLSearchParams()
    params.set('maxResults', '500')
    if (pageToken) params.set('pageToken', pageToken)
    if (safeQuery) params.set('q', safeQuery)

    const data = await gmailFetch(`/messages?${params.toString()}`, accessToken)
    const batch = data.messages || []
    ids.push(...batch.map(m => m.id))

    pageToken = data.nextPageToken || ''
    onProgress?.({ phase: 'listing', count: ids.length, estimate: data.resultSizeEstimate || 0 })

    if (maxMessages > 0 && ids.length >= maxMessages) {
      return ids.slice(0, maxMessages)
    }
  } while (pageToken)

  return ids
}

export async function fetchMetadataForIds({ accessToken, ids, concurrency = 12, onProgress }) {
  const results = []
  let index = 0
  let completed = 0

  async function worker() {
    while (index < ids.length) {
      const id = ids[index++]
      try {
        const params = new URLSearchParams()
        params.set('format', 'metadata')
        params.append('metadataHeaders', 'From')
        params.append('metadataHeaders', 'Subject')
        params.append('metadataHeaders', 'Date')

        const msg = await gmailFetch(`/messages/${id}?${params.toString()}`, accessToken)
        const from = getHeader(msg, 'From')
        const subject = getHeader(msg, 'Subject')
        const date = getHeader(msg, 'Date')
        const sender = parseEmailAddress(from)

        results.push({
          id,
          threadId: msg.threadId,
          labelIds: msg.labelIds || [],
          from,
          subject,
          date,
          senderName: sender.name,
          senderEmail: sender.email
        })
      } catch (error) {
        results.push({ id, error: error.message, senderEmail: 'errors', senderName: 'Scan errors' })
      } finally {
        completed++
        if (completed % 25 === 0 || completed === ids.length) {
          onProgress?.({ phase: 'metadata', count: completed, total: ids.length })
        }
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export function groupBySender(messages) {
  const map = new Map()

  for (const msg of messages) {
    const key = msg.senderEmail || 'unknown'
    if (!map.has(key)) {
      map.set(key, {
        key,
        email: key,
        name: msg.senderName || key,
        count: 0,
        ids: [],
        samples: [],
        inboxCount: 0,
        done: false
      })
    }

    const item = map.get(key)
    item.count++
    item.ids.push(msg.id)
    if ((msg.labelIds || []).includes('INBOX')) item.inboxCount++
    if (item.samples.length < 3 && msg.subject) {
      item.samples.push(msg.subject)
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || a.email.localeCompare(b.email))
}

export function chunk(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size))
  return chunks
}

export async function batchModifyMessages({ accessToken, ids, addLabelIds = [], removeLabelIds = [], onProgress }) {
  const chunks = chunk(ids, 1000)
  let done = 0

  for (const idsChunk of chunks) {
    await gmailFetch(`/messages/batchModify`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        ids: idsChunk,
        addLabelIds,
        removeLabelIds
      })
    })
    done += idsChunk.length
    onProgress?.({ done, total: ids.length })
  }
}

export async function archiveSender(accessToken, sender, onProgress) {
  return batchModifyMessages({
    accessToken,
    ids: sender.ids,
    removeLabelIds: ['INBOX'],
    onProgress
  })
}

export async function trashSender(accessToken, sender, onProgress) {
  return batchModifyMessages({
    accessToken,
    ids: sender.ids,
    addLabelIds: ['TRASH'],
    removeLabelIds: ['INBOX'],
    onProgress
  })
}
