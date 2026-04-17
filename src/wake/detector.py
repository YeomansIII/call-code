import openwakeword
import sys
import json
import numpy as np

model = openwakeword.Model(wakeword_models=["hey_jarvis"], inference_framework="onnx")

CHUNK_SIZE = 1280  # 80ms at 16kHz, 16-bit = 1280 bytes

while True:
    chunk = sys.stdin.buffer.read(CHUNK_SIZE)
    if len(chunk) < CHUNK_SIZE:
        break
    audio = np.frombuffer(chunk, dtype=np.int16)
    prediction = model.predict(audio)
    score = prediction["hey_jarvis"]
    if score > 0.5:
        event = json.dumps({"event": "wake", "score": round(float(score), 3)})
        sys.stdout.write(event + "\n")
        sys.stdout.flush()
