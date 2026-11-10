import { once } from 'node:events'
import process from 'node:process'

export async function connectBrowser() {
  const tabs = await (await fetch(`http://127.0.0.1:${process.env.BOOKING_CDP_PORT || '9335'}/json/list`)).json()
  const tab = tabs.find(t => t.type === 'page')
  if (!tab?.webSocketDebuggerUrl) throw new Error('No local headless page available')
  const socket = new WebSocket(tab.webSocketDebuggerUrl)
  await once(socket, 'open')
  let sequence = 0
  const pending = new Map()
  socket.addEventListener('message', event => {
    const response = JSON.parse(event.data)
    if (response.id && pending.has(response.id)) {
      const { resolve, reject, timer } = pending.get(response.id)
      clearTimeout(timer); pending.delete(response.id)
      if (response.error) reject(new Error(JSON.stringify(response.error)))
      else resolve(response.result)
    }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)) }, 15000)
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'Browser evaluation failed')
    return result.result.value
  }
  const waitFor = async expression => {
    const until = Date.now() + 12000
    while (Date.now() < until) {
      if (await evaluate(`Boolean(${expression})`)) return
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Browser condition timed out: ' + expression + '\n' + await evaluate('document.body.innerText.slice(0,1600)'))
  }
  await send('Page.enable'); await send('Runtime.enable')
  return { send, evaluate, waitFor, close: () => socket.close() }
}
