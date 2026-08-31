let queue: string[] = [];
let speaking = false;

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pump() {
  if (speaking || queue.length === 0 || !ttsSupported()) return;
  const text = queue.shift()!;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.05;
  utter.onend = () => {
    speaking = false;
    pump();
  };
  utter.onerror = () => {
    speaking = false;
    pump();
  };
  speaking = true;
  window.speechSynthesis.speak(utter);
}

export function speak(text: string) {
  if (!ttsSupported()) return;
  queue.push(text);
  if (queue.length > 4) queue = queue.slice(-4);
  pump();
}

export function cancelSpeech() {
  queue = [];
  if (ttsSupported()) window.speechSynthesis.cancel();
  speaking = false;
}
