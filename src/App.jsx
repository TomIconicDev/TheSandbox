import React, { useMemo, useRef, useState } from 'react'
import { Archive, Trash2, Mail, Search, ShieldCheck, LogIn, RefreshCw } from 'lucide-react'
import {
  GMAIL_SCOPE,
  archiveSender,
  fetchMetadataForIds,
  groupBySender,
  listMessageIds,
  trashSender
} from './gmail.js'

const DEFAULT_QUERY = '-in:chats'
const SAVED_CLIENT_ID_KEY = 'gmailSwipeCleaner.clientId'

function useGoogleToken(clientId, setStatus) {
  const tokenClientRef = useRef(null)
  const [accessToken, setAccessToken] = useState('')

  function ensureGoogleLoaded() {
    if (!window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services has not loaded yet. Refresh and try again.')
    }
  }

  function signIn() {
    ensureGoogleLoaded()

    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: GMAIL_SCOPE,
      callback: (response) => {
        if (response.error) {
          setStatus(`Login error: ${response.error}`)
          return
        }
        setAccessToken(response.access_token)
        setStatus('Connected to Gmail. Ready to scan.')
      }
    })

    tokenClientRef.current.requestAccessToken({ prompt: 'consent' })
  }

  function signOut() {
    if (accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken)
    }
    setAccessToken('')
    setStatus('Signed out.')
  }

  return { accessToken, signIn, signOut }
}

function SenderCard({ sender, onArchive, onTrash, busy }) {
  const [dragX, setDragX] = useState(0)
  const startX = useRef(null)

  function onPointerDown(e) {
    if (busy || sender.done) return
    startX.current = e.clientX
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e) {
    if (startX.current === null || busy || sender.done) return
    const delta = e.clientX - startX.current
    setDragX(Math.max(-140, Math.min(140, delta)))
  }

  function onPointerUp() {
    if (busy || sender.done) return
    if (dragX < -90) onTrash(sender)
    else if (dragX > 90) onArchive(sender)

    setDragX(0)
    startX.current = null
  }

  const actionHint = dragX < -35 ? 'trash' : dragX > 35 ? 'archive' : ''

  return (
    <div className={`cardWrap ${sender.done ? 'done' : ''}`}>
      <div className="cardBg">
        <div className="leftAction"><Archive size={24} /> Archive</div>
        <div className="rightAction"><Trash2 size={24} /> Bin</div>
      </div>

      <article
        className={`senderCard ${actionHint}`}
        style={{ transform: `translateX(${dragX}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { setDragX(0); startX.current = null }}
      >
        <div className="senderTop">
          <div className="avatar">{sender.name.slice(0, 1).toUpperCase()}</div>
          <div className="senderMain">
            <h3>{sender.name}</h3>
            <p>{sender.email}</p>
          </div>
          <div className="countBadge">
            <strong>{sender.count.toLocaleString()}</strong>
            <span>emails</span>
          </div>
        </div>

        <div className="samples">
          {sender.samples.length ? sender.samples.map((s, i) => <p key={i}>“{s}”</p>) : <p>No subjects found</p>}
        </div>

        <div className="cardActions">
          <button disabled={busy || sender.done} onClick={() => onArchive(sender)}>
            <Archive size={18} /> Archive all
          </button>
          <button disabled={busy || sender.done} className="danger" onClick={() => onTrash(sender)}>
            <Trash2 size={18} /> Move to Bin
          </button>
        </div>
      </article>
    </div>
  )
}

export default function App() {
  const [clientId, setClientId] = useState(localStorage.getItem(SAVED_CLIENT_ID_KEY) || '')
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [maxMessages, setMaxMessages] = useState(5000)
  const [senders, setSenders] = useState([])
  const [status, setStatus] = useState('Add your Google OAuth Web Client ID, then connect.')
  const [progress, setProgress] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')

  const { accessToken, signIn, signOut } = useGoogleToken(clientId, setStatus)

  const visibleSenders = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return senders
    return senders.filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
  }, [senders, filter])

  function saveClientId(value) {
    setClientId(value)
    localStorage.setItem(SAVED_CLIENT_ID_KEY, value)
  }

  async function scan() {
    if (!accessToken) {
      setStatus('Connect to Gmail first.')
      return
    }

    setBusy(true)
    setProgress('Starting scan...')
    setSenders([])

    try {
      const ids = await listMessageIds({
        accessToken,
        query,
        maxMessages: Number(maxMessages) || 0,
        onProgress: (p) => setProgress(`Listing messages: ${p.count.toLocaleString()} found${p.estimate ? `, estimate ${p.estimate.toLocaleString()}` : ''}`)
      })

      const metadata = await fetchMetadataForIds({
        accessToken,
        ids,
        concurrency: 12,
        onProgress: (p) => setProgress(`Reading sender headers: ${p.count.toLocaleString()} / ${p.total.toLocaleString()}`)
      })

      const grouped = groupBySender(metadata)
      setSenders(grouped)
      setStatus(`Scan complete. Found ${grouped.length.toLocaleString()} senders from ${ids.length.toLocaleString()} messages.`)
      setProgress('')
    } catch (error) {
      setStatus(error.message)
      setProgress('')
    } finally {
      setBusy(false)
    }
  }

  async function doArchive(sender) {
    setBusy(true)
    setStatus(`Archiving ${sender.count.toLocaleString()} emails from ${sender.name}...`)
    try {
      await archiveSender(accessToken, sender, (p) => setProgress(`Archived ${p.done.toLocaleString()} / ${p.total.toLocaleString()}`))
      markDone(sender.key, 'archived')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  async function doTrash(sender) {
    const ok = confirm(`Move ${sender.count.toLocaleString()} emails from ${sender.name} to Gmail Bin?`)
    if (!ok) return

    setBusy(true)
    setStatus(`Moving ${sender.count.toLocaleString()} emails from ${sender.name} to Bin...`)
    try {
      await trashSender(accessToken, sender, (p) => setProgress(`Moved ${p.done.toLocaleString()} / ${p.total.toLocaleString()} to Bin`))
      markDone(sender.key, 'trashed')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  function markDone(key, action) {
    setSenders(current => current.map(s => s.key === key ? { ...s, done: true, action } : s))
    setStatus(`Done: ${action}.`)
  }

  return (
    <main className="appShell">
      <section className="hero">
        <div>
          <div className="pill"><ShieldCheck size={16} /> Browser-only Gmail cleaner</div>
          <h1>Gmail Swipe Cleaner</h1>
          <p>Scan senders, group their emails, then swipe right to archive or left to move them to Bin.</p>
        </div>
        <Mail className="heroIcon" size={54} />
      </section>

      <section className="panel">
        <label>
          Google OAuth Web Client ID
          <input
            value={clientId}
            onChange={(e) => saveClientId(e.target.value)}
            placeholder="1234567890-abc.apps.googleusercontent.com"
          />
        </label>

        <div className="buttonRow">
          {!accessToken ? (
            <button className="primary" disabled={!clientId.trim()} onClick={signIn}>
              <LogIn size={18} /> Connect Gmail
            </button>
          ) : (
            <button onClick={signOut}>Sign out</button>
          )}
        </div>

        <div className="grid2">
          <label>
            Gmail search query
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="-in:chats older_than:1y" />
          </label>
          <label>
            Max messages to scan, 0 = all
            <input type="number" min="0" value={maxMessages} onChange={(e) => setMaxMessages(e.target.value)} />
          </label>
        </div>

        <button className="primary wide" disabled={busy || !accessToken} onClick={scan}>
          <RefreshCw size={18} className={busy ? 'spin' : ''} /> Scan Gmail
        </button>

        <p className="status">{status}</p>
        {progress && <p className="progress">{progress}</p>}
      </section>

      {senders.length > 0 && (
        <section className="toolbar">
          <div className="searchBox">
            <Search size={18} />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter senders..." />
          </div>
          <span>{visibleSenders.length.toLocaleString()} cards</span>
        </section>
      )}

      <section className="cards">
        {visibleSenders.map(sender => (
          <SenderCard
            key={sender.key}
            sender={sender}
            busy={busy}
            onArchive={doArchive}
            onTrash={doTrash}
          />
        ))}
      </section>
    </main>
  )
}
