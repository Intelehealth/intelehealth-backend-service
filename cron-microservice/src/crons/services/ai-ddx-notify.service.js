const DEFAULT_TIMEOUT_MS = 5000;

const envValue = (name) => {
  const raw = process.env[name];
  if (!raw) {
    return '';
  }
  return raw.trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
};

const notifyDdxStatus = async (visitUuid, status) => {
  const url = envValue('AI_DDX_NOTIFY_URL');
  const token = envValue('AI_DDX_NOTIFY_TOKEN');
  if (!url || !token) {
    return { skipped: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AI-DDX-Notify-Token': token },
      body: JSON.stringify({ visitUuid, status }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`[ddx-worker] notify ${visitUuid} (${status}) failed: portal responded ${response.status}`);
      return { notified: false };
    }
    return { notified: true };
  } catch (error) {
    console.warn(`[ddx-worker] notify ${visitUuid} (${status}) failed: ${error.message}`);
    return { notified: false };
  } finally {
    clearTimeout(timer);
  }
};

module.exports = { notifyDdxStatus };
