import {
  GMAIL_SCOPE,
  archiveSender,
  fetchMetadataForIds,
  groupBySender,
  listMessageIds,
  moveSenderToBin
} from './gmail.js'

const savedClientIdKey = 'gmailSwipeCleaner.clientId'

const els = {
  clientId: document.querySelector('#clientId'),
  connectBtn: document.querySelector('#connectBtn'),
  signOutBtn: document.querySelector('#signOutBtn'),
  scanBtn: document.querySelector('#scanBtn'),
  query: document.querySelector('#query'),
  maxMessages: document.querySelector('#maxMessages'),
  status: document.querySelector('#status'),
  progress: document.querySelector('#progress'),
  tools: document.querySelector('#tools'),
  filter: document.querySelector('#filter'),
  cardCount: document.querySelector('#cardCount'),
  cards: document.querySelector('#cards')
}

let tokenClient = null
let accessToken = ''
let senders = []
let busy = false

els.clientId.value = localStorage.getItem(savedClientIdKey) || ''

function setStatus(message) {
  els.status.textContent = message
}

function setProgress(message = '') {
  els.progress.textContent = message
}

function setBusy(value) {
  busy = value
  els.scanBtn.disabled = !accessToken || busy
  els.connectBtn.disabled = busy || !els.clientId.value.trim()
}

function showConnectedState() {
  els.connectBtn.classList.add('hidden')
  els.signOutBtn.classList.remove('hidden')
  els.scanBtn.disabled = false
}

function showSignedOutState() {
  els.connectBtn.classList.remove('hidden')
  els.signOutBtn.classList.add('hidden')
  els.scanBtn.disabled = true
}

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString()
}

function waitForGoogle(maxMs = 6000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const timer = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(timer)
        resolve()
      } else if (Date.now() - start > maxMs) {
        clearInterval(timer)
        reject(new Error('Google login script did not load. Refresh and try again.'))
      }
    }, 100)
  })
}

async function connectGmail() {
  const clientId = els.clientId.value.trim()
  if (!clientId) {
    setStatus('Paste your Google OAuth Web Client ID first.')
    return
  }

  localStorage.setItem(savedClientIdKey, clientId)

  try {
    await waitForGoogle()

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPE,
      callback: response => {
        if (response.error) {
          setStatus(`Login error: ${response.error}`)
          return
        }

        accessToken = response.access_token
        showConnectedState()
        setStatus('Connected to Gmail. Ready to scan.')
      }
    })

    tokenClient.requestAccessToken({ prompt: 'consent' })
  } catch (error) {
    setStatus(error.message)
  }
}

function signOut() {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken)
  }

  accessToken = ''
  senders = []
  renderCards()
  showSignedOutState()
  setStatus('Signed out.')
  setProgress('')
}

async function scanGmail() {
  if (!accessToken) {
    setStatus('Connect Gmail first.')
    return
  }

  setBusy(true)
  setProgress('Starting scan...')
  senders = []
  renderCards()

  try {
    const maxMessages = Number(els.maxMessages.value) || 0
    const query = els.query.value.trim()

    const ids = await listMessageIds({
      accessToken,
      query,
      maxMessages,
      onProgress: p => {
        setProgress(`Listing messages: ${formatNumber(p.count)} found${p.estimate ? `, estimate ${formatNumber(p.estimate)}` : ''}`)
      }
    })

    if (!ids.length) {
      setStatus('No messages matched that search.')
      setProgress('')
      return
    }

    const metadata = await fetchMetadataForIds({
      accessToken,
      ids,
      concurrency: 10,
      onProgress: p => {
        setProgress(`Reading sender headers: ${formatNumber(p.count)} / ${formatNumber(p.total)}`)
      }
    })

    senders = groupBySender(metadata)
    renderCards()

    setStatus(`Scan complete. Found ${formatNumber(senders.length)} senders from ${formatNumber(ids.length)} messages.`)
    setProgress('')
  } catch (error) {
    setStatus(error.message)
    setProgress('')
  } finally {
    setBusy(false)
  }
}

function renderCards() {
  const filter = els.filter.value.trim().toLowerCase()
  const visible = senders.filter(sender => {
    if (!filter) return true
    return sender.name.toLowerCase().includes(filter) || sender.email.toLowerCase().includes(filter)
  })

  els.tools.classList.toggle('hidden', senders.length === 0)
  els.cardCount.textContent = `${formatNumber(visible.length)} cards`

  els.cards.innerHTML = visible.map(sender => {
    const samples = sender.samples.length
      ? sender.samples.map(sample => `<p>“${escapeHtml(sample)}”</p>`).join('')
      : '<p>No subjects found</p>'

    return `
      <div class="cardWrap ${sender.done ? 'done' : ''}" data-key="${escapeHtml(sender.key)}">
        <div class="cardBg">
          <div>📦 Archive</div>
          <div>🗑️ Bin</div>
        </div>

        <article class="card">
          <div class="senderTop">
            <div class="avatar">${escapeHtml(sender.name.slice(0, 1).toUpperCase())}</div>
            <div class="senderMain">
              <h3>${escapeHtml(sender.name)}</h3>
              <p>${escapeHtml(sender.email)}</p>
            </div>
            <div class="count">
              <strong>${formatNumber(sender.count)}</strong>
              <span>emails</span>
            </div>
          </div>

          <div class="samples">${samples}</div>

          <div class="cardActions">
            <button class="archiveBtn" ${busy || sender.done ? 'disabled' : ''}>📦 Archive all</button>
            <button class="danger binBtn" ${busy || sender.done ? 'disabled' : ''}>🗑️ Move to Bin</button>
          </div>
        </article>
      </div>
    `
  }).join('')

  attachCardEvents()
}

function attachCardEvents() {
  document.querySelectorAll('.cardWrap').forEach(wrap => {
    const key = wrap.dataset.key
    const sender = senders.find(s => s.key === key)
    const card = wrap.querySelector('.card')
    const archiveBtn = wrap.querySelector('.archiveBtn')
    const binBtn = wrap.querySelector('.binBtn')

    let startX = null
    let dragX = 0

    function applyDrag() {
      card.style.transform = `translateX(${dragX}px)`
      card.classList.toggle('archive', dragX > 35)
      card.classList.toggle('trash', dragX < -35)
    }

    card.addEventListener('pointerdown', event => {
      if (busy || sender.done) return
      startX = event.clientX
      card.setPointerCapture?.(event.pointerId)
    })

    card.addEventListener('pointermove', event => {
      if (startX === null || busy || sender.done) return
      const delta = event.clientX - startX
      dragX = Math.max(-140, Math.min(140, delta))
      applyDrag()
    })

    card.addEventListener('pointerup', () => {
      if (startX === null || busy || sender.done) return

      const finalX = dragX
      startX = null
      dragX = 0
      applyDrag()

      if (finalX > 90) archiveThisSender(sender)
      if (finalX < -90) binThisSender(sender)
    })

    card.addEventListener('pointercancel', () => {
      startX = null
      dragX = 0
      applyDrag()
    })

    archiveBtn?.addEventListener('click', () => archiveThisSender(sender))
    binBtn?.addEventListener('click', () => binThisSender(sender))
  })
}

function markDone(key, action) {
  senders = senders.map(sender => {
    if (sender.key !== key) return sender
    return { ...sender, done: true, action }
  })

  renderCards()
}

async function archiveThisSender(sender) {
  if (busy || sender.done) return

  setBusy(true)
  setStatus(`Archiving ${formatNumber(sender.count)} emails from ${sender.name}...`)

  try {
    await archiveSender(accessToken, sender, p => {
      setProgress(`Archived ${formatNumber(p.done)} / ${formatNumber(p.total)}`)
    })

    markDone(sender.key, 'archived')
    setStatus(`Archived emails from ${sender.name}.`)
    setProgress('')
  } catch (error) {
    setStatus(error.message)
  } finally {
    setBusy(false)
  }
}

async function binThisSender(sender) {
  if (busy || sender.done) return

  const ok = confirm(`Move ${formatNumber(sender.count)} emails from ${sender.name} to Gmail Bin?`)
  if (!ok) return

  setBusy(true)
  setStatus(`Moving ${formatNumber(sender.count)} emails from ${sender.name} to Bin...`)

  try {
    await moveSenderToBin(accessToken, sender, p => {
      setProgress(`Moved ${formatNumber(p.done)} / ${formatNumber(p.total)} to Bin`)
    })

    markDone(sender.key, 'binned')
    setStatus(`Moved emails from ${sender.name} to Bin.`)
    setProgress('')
  } catch (error) {
    setStatus(error.message)
  } finally {
    setBusy(false)
  }
}

els.clientId.addEventListener('input', () => {
  localStorage.setItem(savedClientIdKey, els.clientId.value.trim())
  setBusy(false)
})

els.connectBtn.addEventListener('click', connectGmail)
els.signOutBtn.addEventListener('click', signOut)
els.scanBtn.addEventListener('click', scanGmail)
els.filter.addEventListener('input', renderCards)

document.querySelectorAll('.queryPreset').forEach(button => {
  button.addEventListener('click', () => {
    els.query.value = button.dataset.query
    setStatus(`Query set: ${button.dataset.query}`)
  })
})

setBusy(false)
