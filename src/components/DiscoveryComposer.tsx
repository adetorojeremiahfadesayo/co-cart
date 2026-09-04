import { useRef, useState } from "react";
import { startImageDiscovery, startTextDiscovery, startUrlDiscovery } from "../agent/startDiscovery";
import { REQUEST_MAX_LENGTH, REQUEST_MIN_LENGTH, validateDiscoveryText } from "../decision/shoppingBrief";

type ComposerMode = "text" | "image" | "url";

const MODES: Array<{ id: ComposerMode; label: string }> = [
  { id: "text", label: "Describe it" },
  { id: "image", label: "Upload a photo" },
  { id: "url", label: "Paste a product link" },
];

const MAX_IMAGE_BYTES = 8_000_000;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const modeHints: Record<ComposerMode, string> = {
  text: "Plain language works best — include budget, destination, or deal-breakers if you have them.",
  image: "JPEG, PNG, or WebP up to 8 MB. The photo is sent to OpenAI once to identify the product, then discarded — it is never stored.",
  url: "One public https:// product link. The page is inspected on our server; your cookies are never sent.",
};

// Re-encoding through a canvas strips EXIF and other metadata before upload.
async function normalizeImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onerror = () => reject(new Error("The image could not be decoded."));
    element.onload = () => resolve(element);
    element.src = dataUrl;
  });
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The image could not be prepared in this browser.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const normalized = canvas.toDataURL("image/png");
  if (Math.round((normalized.length - normalized.indexOf(",") - 1) * 0.75) > MAX_IMAGE_BYTES) {
    throw new Error("The image is still larger than 8 MB after resizing. Try a smaller photo.");
  }
  return normalized;
}

export default function DiscoveryComposer() {
  const [mode, setMode] = useState<ComposerMode>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const switchMode = (next: ComposerMode) => {
    setLocalError(null);
    setMode(next); // Entered content is preserved per mode for the session.
  };

  const submitText = () => {
    const valid = validateDiscoveryText(text);
    if (!valid) {
      setLocalError(`Describe the product in ${REQUEST_MIN_LENGTH}–${REQUEST_MAX_LENGTH} characters.`);
      return;
    }
    setLocalError(null);
    startTextDiscovery(valid).catch(() => { /* The store surfaces the recoverable error on this screen. */ });
  };

  const submitUrl = () => {
    try {
      setLocalError(null);
      startUrlDiscovery(url).catch(() => { /* surfaced via store */ });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "That link could not be used.");
    }
  };

  const chooseImage = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setLocalError("Only JPEG, PNG, or WebP images are accepted.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setLocalError("The image must be 8 MB or smaller.");
      return;
    }
    setPreparing(true);
    setLocalError(null);
    try {
      const dataUrl = await normalizeImage(file);
      setImage({ dataUrl, name: file.name });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "The image could not be prepared.");
    } finally {
      setPreparing(false);
    }
  };

  const submitImage = () => {
    if (!image) {
      setLocalError("Choose a photo first.");
      return;
    }
    setLocalError(null);
    startImageDiscovery(image.dataUrl).catch(() => { /* surfaced via store */ });
  };

  return (
    <section className="composer" aria-label="Product search composer">
      <div className="composer__modes" role="tablist" aria-label="How do you want to describe the product?">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            className={`composer__mode ${mode === item.id ? "composer__mode--active" : ""}`}
            onClick={() => switchMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="composer__panel" role="tabpanel">
        {mode === "text" && (
          <>
            <label className="composer__label" htmlFor="composer-text">Describe the product you are trying to find</label>
            <textarea
              id="composer-text"
              className="composer__textarea"
              value={text}
              maxLength={REQUEST_MAX_LENGTH}
              rows={2}
              placeholder="For example: a quiet mechanical keyboard for work under $120"
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submitText();
              }}
            />
            <div className="composer__row">
              <span className="composer__hint">{modeHints.text}</span>
              <button type="button" className="button button--primary" onClick={submitText} disabled={!text.trim()}>
                Interpret request <span aria-hidden>→</span>
              </button>
            </div>
          </>
        )}

        {mode === "image" && (
          <>
            <span className="composer__label" id="composer-image-label">Add a reference photo</span>
            <div className="composer__upload">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="composer__file"
                aria-labelledby="composer-image-label"
                onChange={(event) => void chooseImage(event.target.files?.[0])}
              />
              {image && (
                <figure className="composer__preview">
                  <img src={image.dataUrl} alt={`Reference photo preview: ${image.name}`} />
                  <figcaption>{image.name}</figcaption>
                </figure>
              )}
            </div>
            <div className="composer__row">
              <span className="composer__hint">{modeHints.image}</span>
              <button type="button" className="button button--primary" onClick={submitImage} disabled={!image || preparing}>
                {preparing ? "Preparing photo…" : "Interpret photo"} <span aria-hidden>→</span>
              </button>
            </div>
          </>
        )}

        {mode === "url" && (
          <>
            <label className="composer__label" htmlFor="composer-url">Paste one public product link</label>
            <input
              id="composer-url"
              type="url"
              className="composer__input"
              value={url}
              placeholder="https://store.example/products/…"
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitUrl();
              }}
            />
            <div className="composer__row">
              <span className="composer__hint">{modeHints.url}</span>
              <button type="button" className="button button--primary" onClick={submitUrl} disabled={!url.trim()}>
                Interpret link <span aria-hidden>→</span>
              </button>
            </div>
          </>
        )}

        {localError && <p className="composer__error" role="alert">{localError}</p>}
      </div>
    </section>
  );
}
