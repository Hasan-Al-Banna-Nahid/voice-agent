"use client";

import { useState, useEffect, useRef } from "react";
import {
  Phone,
  PhoneOff,
  Settings,
  History,
  BarChart3,
  User,
  Volume2,
  MessageSquare,
  Mic,
  MicOff,
  AlertCircle,
} from "lucide-react";

interface ConversationEntry {
  id: string;
  timestamp: Date;
  userMessage: string;
  aiResponse: string;
  mood?: string;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

export default function VoiceMoodDashboard() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMicPermissionGranted, setIsMicPermissionGranted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const settings = {
    voice: "alloy",
    speed: 1.0,
    moodTracking: true,
  };

  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Load conversations from localStorage
  useEffect(() => {
    const saved =
      typeof window != "undefined" &&
      localStorage.getItem("voice-mood-conversations");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConversations(
          parsed.map((conv: any) => ({
            ...conv,
            timestamp: new Date(conv.timestamp),
          }))
        );
      } catch (e) {
        console.error("Error loading conversations:", e);
      }
    }
  }, []);

  // Save conversations to localStorage
  useEffect(() => {
    if (conversations.length > 0) {
      typeof window != "undefined" &&
        localStorage.setItem(
          "voice-mood-conversations",
          JSON.stringify(conversations)
        );
    }
  }, [conversations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeechRecognition();
      stopSpeechSynthesis();
      cleanupAudioAnalysis();
    };
  }, []);

  const checkMicrophonePermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Stop the stream immediately after checking permission
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      console.error("Microphone permission denied:", error);
      return false;
    }
  };

  const setupAudioAnalysis = async (stream: MediaStream) => {
    try {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const analyzeAudio = () => {
        if (!analyserRef.current || !isCallActive) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setAudioLevel(Math.min(average / 128, 1)); // Normalize to 0-1

        requestAnimationFrame(analyzeAudio);
      };

      analyzeAudio();
    } catch (error) {
      console.error("Audio analysis setup failed:", error);
    }
  };

  const cleanupAudioAnalysis = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const startCall = async () => {
    setError(null);
    setCurrentTranscript("");

    try {
      // Check microphone permission first
      const hasPermission = await checkMicrophonePermission();
      if (!hasPermission) {
        setError(
          "Microphone access is required. Please allow microphone permissions and try again."
        );
        return;
      }

      setIsMicPermissionGranted(true);
      setIsCallActive(true);

      // Get media stream for audio analysis
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
      await setupAudioAnalysis(stream);

      await startSpeechRecognition();
    } catch (error) {
      console.error("Failed to start call:", error);
      setError(
        "Failed to access microphone. Please check your permissions and try again."
      );
      setIsCallActive(false);
    }
  };

  const endCall = () => {
    setIsCallActive(false);
    setCurrentTranscript("");
    setError(null);
    stopSpeechRecognition();
    stopSpeechSynthesis();
    cleanupAudioAnalysis();
  };

  const initializeSpeechRecognition = () => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      // Configure for better speech detection
      (recognition as any).continuous = true;
      (recognition as any).interimResults = true;

      return recognition;
    }
    return null;
  };

  const startSpeechRecognition = async () => {
    const recognition = initializeSpeechRecognition();
    if (!recognition) {
      setError(
        "Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari."
      );
      return;
    }

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      console.log("Speech recognition started");
    };

    recognition.onresult = async (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      //   Update UI with interim results
      if (interimTranscript) {
        setCurrentTranscript((prev) => {
          const base = prev.split("|")[0].trim();
          return base + (base ? " " : "") + interimTranscript + " |";
        });
      }

      //   Process final results
      if (finalTranscript) {
        setCurrentTranscript((prev) => {
          const base = prev.split("|")[0].trim();
          return base + (base ? " " : "") + finalTranscript;
        });

        setIsProcessing(true);
        await processUserMessage(finalTranscript.trim());
        setIsProcessing(false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);

      switch (event.error) {
        case "no-speech":
          setError(
            "No speech detected. Please speak louder or check your microphone."
          );
          break;
        case "audio-capture":
          setError(
            "No microphone found. Please ensure a microphone is connected."
          );
          break;
        case "not-allowed":
          setError(
            "Microphone permission denied. Please allow microphone access."
          );
          setIsMicPermissionGranted(false);
          break;
        case "network":
          setError("Network error occurred. Please check your connection.");
          break;
        default:
          setError(`Speech recognition error: ${event.error}`);
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      console.log("Speech recognition ended");
      setIsListening(false);

      // Restart recognition if call is still active
      if (isCallActive && recognitionRef.current) {
        setTimeout(() => {
          if (isCallActive && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.error("Error restarting recognition:", error);
            }
          }
        }, 100);
      }
    };

    try {
      recognition.start();
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      setError("Failed to start speech recognition. Please try again.");
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error("Error stopping recognition:", error);
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const stopSpeechSynthesis = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const processUserMessage = async (message: string) => {
    if (!message.trim() || message.length < 2) return;

    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "GPT Voice Mood",
          },
          body: JSON.stringify({
            model: "openai/gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful and empathetic AI assistant. Analyze the user's mood from their message and respond appropriately. Keep responses conversational and under 100 words. Be engaging and supportive.",
              },
              {
                role: "user",
                content: message,
              },
            ],
            max_tokens: 150,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid response format from API");
      }

      const aiResponse = data.choices[0].message.content;

      // Enhanced mood detection
      const mood = detectMood(message);

      const newEntry: ConversationEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        userMessage: message,
        aiResponse: aiResponse,
        mood: mood,
      };

      setConversations((prev) => [newEntry, ...prev.slice(0, 49)]); // Keep last 50 conversations
      speakText(aiResponse);
    } catch (error) {
      console.error("Error calling OpenRouter API:", error);
      const fallbackResponse =
        "I understand how you're feeling. Let's continue our conversation. What's on your mind?";

      const newEntry: ConversationEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        userMessage: message,
        aiResponse: fallbackResponse,
        mood: detectMood(message),
      };

      setConversations((prev) => [newEntry, ...prev]);
      speakText(fallbackResponse);
    }
  };

  const detectMood = (text: string): string => {
    const positiveWords = [
      "happy",
      "good",
      "great",
      "excited",
      "wonderful",
      "amazing",
      "love",
      "excellent",
      "fantastic",
      "perfect",
      "joy",
      "pleased",
    ];
    const negativeWords = [
      "sad",
      "bad",
      "angry",
      "upset",
      "frustrated",
      "hate",
      "terrible",
      "awful",
      "horrible",
      "annoying",
      "disappointed",
      "stress",
    ];

    const lowerText = text.toLowerCase();

    const positiveCount = positiveWords.filter((word) =>
      lowerText.includes(word)
    ).length;
    const negativeCount = negativeWords.filter((word) =>
      lowerText.includes(word)
    ).length;

    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  };

  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      stopSpeechSynthesis();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settings.speed;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      // Get available voices and select a natural one
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (voice) =>
          voice.name.includes("Google") ||
          voice.name.includes("Natural") ||
          voice.name.includes("Samantha")
      );

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
      synthesisRef.current = utterance;
    }
  };

  const clearHistory = () => {
    setConversations([]);
    typeof window != "undefined" &&
      localStorage.removeItem("voice-mood-conversations");
  };

  const getMicStatusText = () => {
    if (!isMicPermissionGranted) return "Microphone access required";
    if (isListening) return "Listening... Speak now";
    if (isProcessing) return "Processing your message...";
    return "Ready to listen";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            GPT Voice Mood
          </h1>
          <p className="text-gray-600">
            Your AI companion for mood tracking and conversation
          </p>
        </header>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Call Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Start Session Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="text-center">
                {!isCallActive ? (
                  <div className="space-y-4">
                    <button
                      onClick={startCall}
                      className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full font-semibold text-lg flex items-center justify-center mx-auto gap-3 transition-all duration-200 transform hover:scale-105 shadow-lg"
                    >
                      <Phone size={24} />
                      Start Voice Session
                    </button>
                    <p className="text-sm text-gray-500">
                      Click to start a conversation with AI voice assistant
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Audio Level Visualization */}
                    <div className="flex items-center justify-center gap-4">
                      <div
                        className={`p-3 rounded-full ${
                          isListening
                            ? "bg-green-100 text-green-600"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {isListening ? <Mic size={24} /> : <MicOff size={24} />}
                      </div>
                      <div className="flex-1 max-w-md">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 transition-all duration-100"
                              style={{ width: `${audioLevel * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">
                            {Math.round(audioLevel * 100)}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 text-center">
                          {getMicStatusText()}
                        </p>
                      </div>
                      <div
                        className={`p-3 rounded-full ${
                          isSpeaking
                            ? "bg-blue-100 text-blue-600 animate-pulse"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        <Volume2 size={24} />
                      </div>
                    </div>

                    {/* Current Transcript */}
                    {/* {currentTranscript && (
                      <div className="bg-gray-50 rounded-lg p-4 border">
                        <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <MessageSquare size={16} />
                          Current Conversation:
                        </h3>
                        <p className="text-gray-600 bg-white p-3 rounded border">
                          {currentTranscript.replace(/\|$/, "")}
                        </p>
                      </div>
                    )} */}

                    {/* End Call Button */}
                    <button
                      onClick={endCall}
                      className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full font-semibold text-lg flex items-center justify-center mx-auto gap-3 transition-all duration-200 shadow-lg"
                    >
                      <PhoneOff size={24} />
                      End Call
                    </button>

                    {/* Tips */}
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>💡 Speak clearly into your microphone</p>
                      <p>💡 Ensure you're in a quiet environment</p>
                      <p>💡 Allow a moment after speaking for processing</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Section */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <BarChart3 size={20} />
                  Progress Insights
                </h2>
                {conversations.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-sm text-red-500 hover:text-red-700 px-3 py-1 rounded border border-red-200 hover:border-red-300"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {conversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare
                    size={48}
                    className="mx-auto mb-4 opacity-50"
                  />
                  <p>
                    No conversations yet. Start a session to begin tracking!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Mood Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
                      <div className="text-2xl font-bold text-green-600">
                        {
                          conversations.filter((c) => c.mood === "positive")
                            .length
                        }
                      </div>
                      <div className="text-sm text-green-600">Positive</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
                      <div className="text-2xl font-bold text-blue-600">
                        {
                          conversations.filter((c) => c.mood === "neutral")
                            .length
                        }
                      </div>
                      <div className="text-sm text-blue-600">Neutral</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center border border-red-100">
                      <div className="text-2xl font-bold text-red-600">
                        {
                          conversations.filter((c) => c.mood === "negative")
                            .length
                        }
                      </div>
                      <div className="text-sm text-red-600">Negative</div>
                    </div>
                  </div>

                  {/* Recent Conversations */}
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-500">
                            {new Date(conv.timestamp).toLocaleString()}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              conv.mood === "positive"
                                ? "bg-green-100 text-green-800"
                                : conv.mood === "negative"
                                ? "bg-red-100 text-red-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {conv.mood}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <strong className="text-blue-600">You:</strong>
                            <p className="text-gray-700 ml-2">
                              {conv.userMessage}
                            </p>
                          </div>
                          <div>
                            <strong className="text-green-600">AI:</strong>
                            <p className="text-gray-700 ml-2">
                              {conv.aiResponse}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Settings Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4">
                <Settings size={20} />
                Voice Settings
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Speech Speed
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">Slow</span>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={settings.speed}
                      className="flex-1"
                      readOnly
                    />
                    <span className="text-sm text-gray-500">Fast</span>
                  </div>
                  <p className="text-center text-sm text-gray-600 mt-1">
                    {settings.speed}x
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="font-medium text-gray-700 mb-3">
                    Microphone Status
                  </h3>
                  <div className="flex items-center gap-3 text-sm">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isMicPermissionGranted ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <span>
                      {isMicPermissionGranted
                        ? "Microphone connected"
                        : "Microphone access needed"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4">
                <History size={20} />
                Quick Stats
              </h2>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Sessions:</span>
                  <span className="font-semibold">{conversations.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Today:</span>
                  <span className="font-semibold">
                    {
                      conversations.filter(
                        (c) =>
                          new Date(c.timestamp).toDateString() ===
                          new Date().toDateString()
                      ).length
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">This Week:</span>
                  <span className="font-semibold">
                    {
                      conversations.filter((c) => {
                        const weekAgo = new Date();
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return new Date(c.timestamp) > weekAgo;
                      }).length
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Tips Card */}
            <div className="bg-blue-50 rounded-2xl shadow-lg p-6 border border-blue-100">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4">
                💡 Tips
              </h2>

              <div className="space-y-3 text-sm text-gray-600">
                <p>• Speak clearly and at a natural pace</p>
                <p>• Ensure good microphone positioning</p>
                <p>• Reduce background noise for better accuracy</p>
                <p>• Allow the AI to finish speaking before responding</p>
                <p>• Use Chrome or Edge for best compatibility</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
