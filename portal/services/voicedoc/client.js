'use strict';
const { encryptChunk, importPublicKey } = require('./encryption');

const AUTH_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 120000;
const COMBINED_AUDIO_TIMEOUT_MS = 60000;
const DEFAULT_END_STREAM_TIMEOUT_MS = 600000;

class VoiceDocError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'VoiceDocError';
    this.status = status;
    this.body = body;
  }
}

async function readBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

class VoiceDocClient {
  constructor(cfg) {
    this.cfg = cfg;
    this.session = null;
    this.loginPromise = null;
    this.refreshPromise = null;
    this.publicKeyPromise = null;
  }

  async login(retried = false) {
    const { authBaseUrl, helperBaseUrl, email, password } = this.cfg;
    if (!email || !password) {
      throw new VoiceDocError('VOICEDOC_EMAIL and VOICEDOC_PASSWORD must be set, or run with VOICEDOC_MOCK=true', 500);
    }
    const res = await fetch(`${authBaseUrl}/api/auth/login_wrapper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pkd: password }),
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });
    let data = await readBody(res);
    if (res.status === 401 && !retried && this.cfg.forceLogin && JSON.stringify(data).includes('already logged in')) {
      await fetch(`${authBaseUrl}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailid: email }),
        signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
      });
      return this.login(true);
    }
    if (!res.ok) {
      const detail = [data?.detail].flat().map((d) => (typeof d === 'string' ? d : d?.msg)).filter(Boolean).join('; ');
      throw new VoiceDocError(`VoiceDoc login failed (${res.status})${detail ? `: ${detail}` : ''}`, res.status, data);
    }
    if (typeof data === 'string') data = JSON.parse(data);

    const sessionId = Buffer.from(`${email}${new Date().toISOString()}`).toString('base64');
    const session = { token: data.token, refreshToken: data.refreshtoken, sessionId };

    const reg = await fetch(`${helperBaseUrl}/registerSession`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ session_id: sessionId }),
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });
    if (!reg.ok) {
      throw new VoiceDocError(`VoiceDoc session registration failed (${reg.status})`, reg.status, await readBody(reg));
    }
    this.session = session;
  }

  async ensureSession() {
    if (this.session) return;
    this.loginPromise ??= this.login().finally(() => {
      this.loginPromise = null;
    });
    await this.loginPromise;
  }

  async refresh() {
    const res = await fetch(`${this.cfg.authBaseUrl}/refreshtoken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshtoken: this.session?.refreshToken }),
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });
    const data = res.ok ? await readBody(res) : null;
    if (data?.id_token) {
      this.session.token = data.id_token;
      return;
    }
    this.session = null;
    await this.ensureSession();
  }

  async refreshOnce(staleToken) {
    if (this.session && this.session.token !== staleToken) return;
    this.refreshPromise ??= this.refresh().finally(() => {
      this.refreshPromise = null;
    });
    await this.refreshPromise;
  }

  async request(method, url, body, timeoutMs = AUTH_TIMEOUT_MS) {
    await this.ensureSession();
    const send = (token) => {
      const headers = { Authorization: `Bearer ${token}` };
      let payload = body;
      if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
      }
      return fetch(url, { method, headers, body: payload, signal: AbortSignal.timeout(timeoutMs) });
    };
    const token = this.session.token;
    let res = await send(token);
    if (res.status === 401) {
      await this.refreshOnce(token);
      res = await send(this.session.token);
    }
    const data = await readBody(res);
    if (!res.ok) {
      const detail = typeof data === 'object' && data ? data.detail || data.message || data.error : data;
      throw new VoiceDocError(`${method} ${new URL(url).pathname} failed (${res.status})${detail ? `: ${String(detail).slice(0, 200)}` : ''}`, res.status, data);
    }
    return data;
  }

  async prepare({ encrypt }) {
    await this.ensureSession();
    if (encrypt) await this.getPublicKey();
  }

  getPublicKey() {
    this.publicKeyPromise ??= this.request('GET', `${this.cfg.coreBaseUrl}/api/audio-encryption/public-key`)
      .then((data) => importPublicKey(data.public_key))
      .catch((err) => {
        this.publicKeyPromise = null;
        throw err;
      });
    return this.publicKeyPromise;
  }

  async uploadChunk({ wav, chunkId, chunkNumber, name, language, encrypt }) {
    const form = new FormData();
    if (encrypt) {
      const publicKey = await this.getPublicKey();
      const { ciphertext, encryptedKey, iv } = await encryptChunk(publicKey, wav, chunkId, chunkNumber);
      form.append('file', new Blob([ciphertext], { type: 'application/octet-stream' }), `chunk-${chunkNumber}.wav`);
      form.append('encrypted_key', encryptedKey);
      form.append('iv', iv);
    } else {
      form.append('file', new Blob([wav], { type: 'audio/wav' }), `chunk-${chunkNumber}.wav`);
    }
    form.append('chunk_id', chunkId);
    form.append('chunk_number', String(chunkNumber));
    form.append('name', name);
    form.append('language', language);
    return this.request('POST', `${this.cfg.coreBaseUrl}/api/upload-and-transcribe`, form, UPLOAD_TIMEOUT_MS);
  }

  endStream({ chunkId, name, fields, language }) {
    return this.request('POST', `${this.cfg.coreBaseUrl}/api/end-stream`, {
      chunk_id: chunkId,
      name,
      fields,
      source: 'med',
      language,
    }, this.cfg.endStreamTimeoutMs || DEFAULT_END_STREAM_TIMEOUT_MS);
  }

  uploadCombinedAudio({ chunkId, name }) {
    return this.request('POST', `${this.cfg.coreBaseUrl}/api/upload-combined-audio`, {
      chunk_id: chunkId,
      name,
      email: this.cfg.email,
    }, COMBINED_AUDIO_TIMEOUT_MS);
  }

  listRecordings() {
    return this.request('POST', `${this.cfg.coreBaseUrl}/api/json`, { email: this.cfg.email });
  }

  async logout() {
    if (!this.session) return;
    const { token } = this.session;
    this.session = null;
    await fetch(`${this.cfg.authBaseUrl}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ emailid: this.cfg.email, idtoken: token }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }
}

module.exports = { VoiceDocClient, VoiceDocError };
