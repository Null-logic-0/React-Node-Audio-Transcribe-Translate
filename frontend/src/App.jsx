import { useState, useRef } from "react";

function App() {
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        try {
          setLoading(true);
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/wav",
          });
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.wav");

          const res = await fetch("http://localhost:3000/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!res.ok)
            throw new Error(`Server error: ${res.status} ${res.statusText}`);

          const data = await res.json();
          setResult(data);
        } catch (err) {
          console.error(err);
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (err) {
      console.error(err);
      setError("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    setRecording(false);
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Audio Transcriber & Translator</h1>
      <button onClick={recording ? stopRecording : startRecording}>
        {recording ? "Stop Recording" : "Start Recording"}
      </button>

      {loading && <p>Processing audio...</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {result && (
        <div style={{ marginTop: "1rem" }}>
          <h3>English:</h3>
          <p>{result.english}</p>
          <h3>Spanish:</h3>
          <p>{result.spanish}</p>
        </div>
      )}
    </div>
  );
}

export default App;
