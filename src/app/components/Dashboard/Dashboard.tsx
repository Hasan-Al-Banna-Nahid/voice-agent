"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Heart,
  Sparkles,
  CheckCircle,
  Save,
  Clock,
  Bell,
  Globe,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";

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

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  timezone: string;
  onboardingAnswers: {
    whatBringsYou: string;
    challenges: string;
    supportNeeded: string;
    checkInTimes: string[];
    aiPreferences: string;
  };
  preferences: {
    checkIns: string[];
    callReminders: boolean;
    moodTracking: boolean;
  };
}

interface OnboardingData {
  whatBringsYou: string;
  challenges: string;
  supportNeeded: string;
  checkInTimes: string[];
  aiPreferences: string;
}

export default function VoiceMoodDashboard() {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    whatBringsYou: "",
    challenges: "",
    supportNeeded: "",
    checkInTimes: [],
    aiPreferences: "",
  });
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMicPermissionGranted, setIsMicPermissionGranted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings">(
    "dashboard"
  );
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

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

  useEffect(() => {
    const checkOnboardingStatus = () => {
      try {
        const onboardingCompleted =
          typeof window !== "undefined" &&
          localStorage.getItem("onboardingCompleted");
        const savedOnboardingData =
          typeof window !== "undefined" && localStorage.getItem("OnBoarding");

        if (!onboardingCompleted && !savedOnboardingData) {
          setShowOnboarding(true);
        } else if (savedOnboardingData) {
          setOnboardingData(JSON.parse(savedOnboardingData));
          setShowOnboarding(false);
        }

        const savedProfile =
          typeof window !== "undefined" && localStorage.getItem("userProfile");
        if (savedProfile) {
          setUserProfile(JSON.parse(savedProfile));
        }

        const savedConversations =
          typeof window !== "undefined" &&
          localStorage.getItem("voice-mood-conversations");
        if (savedConversations) {
          const parsed = JSON.parse(savedConversations);
          setConversations(
            parsed.map((conv: any) => ({
              ...conv,
              timestamp: new Date(conv.timestamp),
            }))
          );
        }
      } catch (e) {
        console.error("Error loading user data:", e);
      }
    };

    checkOnboardingStatus();
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      typeof window !== "undefined" &&
        localStorage.setItem(
          "voice-mood-conversations",
          JSON.stringify(conversations)
        );
    }
  }, [conversations]);

  useEffect(() => {
    return () => {
      stopSpeechRecognition();
      stopSpeechSynthesis();
      cleanupAudioAnalysis();
    };
  }, []);

  const onboardingQuestions = [
    {
      id: "whatBringsYou",
      question: "What brings you here today?",
      description: "Tell us what motivated you to seek support",
      type: "textarea",
      placeholder: "I'm looking for someone to talk to about...",
    },
    {
      id: "challenges",
      question: "What challenges are you facing?",
      description: "Share what's been difficult lately",
      type: "textarea",
      placeholder: "I've been struggling with...",
    },
    {
      id: "supportNeeded",
      question: "What type of support do you need?",
      description: "How can we best help you?",
      type: "textarea",
      placeholder: "I need help with...",
    },
    {
      id: "checkInTimes",
      question: "When would you like to receive check-ins?",
      description: "Select your preferred times for wellness check-ins",
      type: "checkbox",
      options: ["Morning", "Evening", "Sunday"],
    },
    {
      id: "aiPreferences",
      question: "Any preferences for your AI companion?",
      description:
        "Voice style, tone, or anything else that would make you comfortable",
      type: "textarea",
      placeholder: "I prefer a companion that is...",
    },
  ];

  const handleOnboardingInputChange = (value: string | string[]) => {
    const currentQuestionId = onboardingQuestions[currentQuestion].id;
    setOnboardingData((prev) => ({
      ...prev,
      [currentQuestionId]: value,
    }));
  };

  const handleCheckboxToggle = (option: string) => {
    const currentTimes = onboardingData.checkInTimes;
    const updatedTimes = currentTimes.includes(option)
      ? currentTimes.filter((time) => time !== option)
      : [...currentTimes, option];

    handleOnboardingInputChange(updatedTimes);
  };

  const nextQuestion = () => {
    if (currentQuestion < onboardingQuestions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  };

  const triggerN8nWebhook = async (eventType: string, data: any) => {
    try {
      const completeData = {
        eventType,
        timestamp: new Date().toISOString(),
        userProfile: userProfile || {
          id: "unknown",
          name: "",
          email: "",
          phone: "",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          onboardingAnswers: onboardingData,
          preferences: {
            checkIns: [],
            callReminders: true,
            moodTracking: true,
          },
        },
        onboardingData: onboardingData,
        conversations: conversations,
        ...data,
      };

      console.log("Sending to n8n webhook:", completeData);

      const response = await fetch(process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(completeData),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }

      return response.ok;
    } catch (error) {
      console.error("Webhook error:", error);
      return false;
    }
  };

  const completeOnboarding = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("OnBoarding", JSON.stringify(onboardingData));
        localStorage.setItem("onboardingCompleted", "true");

        const baseProfile = {
          id: "user_" + Date.now(),
          name: "",
          email: "",
          phone: "",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          preferences: {
            checkIns: onboardingData.checkInTimes,
            callReminders: true,
            moodTracking: true,
          },
        };

        const updatedProfile: UserProfile = {
          ...baseProfile,
          onboardingAnswers: onboardingData,
        };

        localStorage.setItem("userProfile", JSON.stringify(updatedProfile));
        setUserProfile(updatedProfile);
      }

      await triggerN8nWebhook("onboarding_completed", {
        action: "onboarding_finished",
        userProfile: userProfile,
        onboardingQuestions: onboardingQuestions,
        userResponses: onboardingData,
      });

      setShowOnboarding(false);
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  const checkMicrophonePermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
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
        setAudioLevel(Math.min(average / 128, 1));

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
      const hasPermission = await checkMicrophonePermission();
      if (!hasPermission) {
        setError(
          "Microphone access is required. Please allow microphone permissions and try again."
        );
        return;
      }

      setIsMicPermissionGranted(true);
      setIsCallActive(true);

      await triggerN8nWebhook("call_started", {
        action: "call_start",
        userProfile: userProfile,
        currentConversations: conversations.length,
      });

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

    triggerN8nWebhook("call_ended", {
      action: "call_end",
      conversationCount: conversations.length,
      lastSession: conversations[0] || null,
      userProfile: userProfile,
    });
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

      if (interimTranscript) {
        setCurrentTranscript((prev) => {
          const base = prev.split("|")[0].trim();
          return base + (base ? " " : "") + interimTranscript + " |";
        });
      }

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
      setIsListening(false);
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

    const getFallbackResponse = (userMessage: string): string => {
      const lowerMessage = userMessage.toLowerCase();

      if (
        lowerMessage.includes("hello") ||
        lowerMessage.includes("hi") ||
        lowerMessage.includes("hey")
      ) {
        return "Hello! It's great to hear from you. How has your day been going so far?";
      }

      if (lowerMessage.includes("how are you")) {
        return "I'm functioning well, thank you for asking! I'm here to chat with you. What would you like to talk about today?";
      }

      if (lowerMessage.includes("thank")) {
        return "You're very welcome! I'm glad I could help. Is there anything else on your mind?";
      }

      if (
        lowerMessage.includes("sad") ||
        lowerMessage.includes("upset") ||
        lowerMessage.includes("unhappy")
      ) {
        return "I'm sorry to hear you're feeling this way. It's completely normal to have difficult moments. Would you like to talk more about what's bothering you?";
      }

      if (
        lowerMessage.includes("happy") ||
        lowerMessage.includes("excited") ||
        lowerMessage.includes("good")
      ) {
        return "That's wonderful to hear! I'm glad you're feeling positive. What's been making you feel this way?";
      }

      return "Thank you for sharing that with me. I'm here to listen and help however I can. What else is on your mind?";
    };

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
            model: "openai/gpt-5-chat",
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
      const mood = detectMood(message);

      const newEntry: ConversationEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        userMessage: message,
        aiResponse: aiResponse,
        mood: mood,
      };

      setConversations((prev) => [newEntry, ...prev.slice(0, 49)]);

      await triggerN8nWebhook("conversation_entry", {
        action: "new_conversation",
        conversation: newEntry,
        userProfile: userProfile,
        totalConversations: conversations.length + 1,
      });

      speakText(aiResponse);
    } catch (error) {
      console.error("Error calling OpenRouter API:", error);
      const fallbackResponse = getFallbackResponse(message);
      const mood = detectMood(message);

      const newEntry: ConversationEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        userMessage: message,
        aiResponse: fallbackResponse,
        mood: mood,
      };

      setConversations((prev) => [newEntry, ...prev]);

      await triggerN8nWebhook("conversation_entry_fallback", {
        action: "fallback_conversation",
        conversation: newEntry,
        userProfile: userProfile,
        error: "OpenRouter API failed, using fallback response",
      });

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
    typeof window !== "undefined" &&
      localStorage.removeItem("voice-mood-conversations");

    triggerN8nWebhook("history_cleared", {
      action: "clear_history",
      userProfile: userProfile,
    });
  };

  const getMicStatusText = () => {
    if (!isMicPermissionGranted) return "Microphone access required";
    if (isListening) return "Listening... Speak now";
    if (isProcessing) return "Processing your message...";
    return "Ready to listen";
  };

  const todaySessions = conversations.filter(
    (c) => new Date(c.timestamp).toDateString() === new Date().toDateString()
  ).length;

  const weekSessions = conversations.filter((c) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(c.timestamp) > weekAgo;
  }).length;

  const positiveSessions = conversations.filter(
    (c) => c.mood === "positive"
  ).length;
  const negativeSessions = conversations.filter(
    (c) => c.mood === "negative"
  ).length;
  const neutralSessions = conversations.filter(
    (c) => c.mood === "neutral"
  ).length;

  if (showOnboarding) {
    return (
      <OnboardingQuestionnaire
        questions={onboardingQuestions}
        currentQuestion={currentQuestion}
        data={onboardingData}
        onInputChange={handleOnboardingInputChange}
        onCheckboxToggle={handleCheckboxToggle}
        onNext={nextQuestion}
        onPrev={prevQuestion}
        onComplete={completeOnboarding}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            GPT Voice Mood
          </h1>
          <p className="text-gray-600">
            Your AI companion for mood tracking and conversation
          </p>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mb-8"
        >
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-2 shadow-lg">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                  activeTab === "dashboard"
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 size={20} />
                  Dashboard
                </div>
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                  activeTab === "settings"
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Settings size={20} />
                  Settings
                </div>
              </button>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === "dashboard" ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3"
                >
                  <AlertCircle
                    className="text-red-500 flex-shrink-0"
                    size={20}
                  />
                  <p className="text-red-700 text-sm">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                </motion.div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-white rounded-2xl shadow-lg p-6"
                  >
                    <div className="text-center">
                      {!isCallActive ? (
                        <div className="space-y-4">
                          <motion.button
                            onClick={startCall}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-4 rounded-full font-semibold text-lg flex items-center justify-center mx-auto gap-3 transition-all duration-200 shadow-lg shadow-green-500/30"
                          >
                            <Phone size={24} />
                            Start Voice Session
                          </motion.button>
                          <p className="text-sm text-gray-500">
                            Click to start a conversation with AI voice
                            assistant
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center justify-center gap-4">
                            <div
                              className={`p-3 rounded-full ${
                                isListening
                                  ? "bg-green-100 text-green-600 animate-pulse"
                                  : "bg-gray-100 text-gray-400"
                              }`}
                            >
                              {isListening ? (
                                <Mic size={24} />
                              ) : (
                                <MicOff size={24} />
                              )}
                            </div>
                            <div className="flex-1 max-w-md">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                                    style={{ width: `${audioLevel * 100}%` }}
                                    animate={{ width: `${audioLevel * 100}%` }}
                                    transition={{ duration: 0.1 }}
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

                          <motion.button
                            onClick={endCall}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white px-8 py-4 rounded-full font-semibold text-lg flex items-center justify-center mx-auto gap-3 transition-all duration-200 shadow-lg shadow-red-500/30"
                          >
                            <PhoneOff size={24} />
                            End Call
                          </motion.button>

                          <div className="text-xs text-gray-500 space-y-1">
                            <p>💡 Speak clearly into your microphone</p>
                            <p>💡 Ensure you're in a quiet environment</p>
                            <p>
                              💡 Allow a moment after speaking for processing
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-2xl shadow-lg p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                        <BarChart3 size={20} />
                        Progress Insights
                      </h2>
                      {conversations.length > 0 && (
                        <motion.button
                          onClick={clearHistory}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="text-sm text-red-500 hover:text-red-700 px-3 py-1 rounded border border-red-200 hover:border-red-300 transition-all duration-200"
                        >
                          Clear History
                        </motion.button>
                      )}
                    </div>

                    {conversations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <MessageSquare
                          size={48}
                          className="mx-auto mb-4 opacity-50"
                        />
                        <p>
                          No conversations yet. Start a session to begin
                          tracking!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="bg-green-50 rounded-lg p-4 text-center border border-green-100"
                          >
                            <div className="text-2xl font-bold text-green-600">
                              {positiveSessions}
                            </div>
                            <div className="text-sm text-green-600">
                              Positive
                            </div>
                          </motion.div>
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100"
                          >
                            <div className="text-2xl font-bold text-blue-600">
                              {neutralSessions}
                            </div>
                            <div className="text-sm text-blue-600">Neutral</div>
                          </motion.div>
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="bg-red-50 rounded-lg p-4 text-center border border-red-100"
                          >
                            <div className="text-2xl font-bold text-red-600">
                              {negativeSessions}
                            </div>
                            <div className="text-sm text-red-600">Negative</div>
                          </motion.div>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {conversations.map((conv, index) => (
                            <motion.div
                              key={conv.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
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
                                  <strong className="text-blue-600">
                                    You:
                                  </strong>
                                  <p className="text-gray-700 ml-2">
                                    {conv.userMessage}
                                  </p>
                                </div>
                                <div>
                                  <strong className="text-green-600">
                                    AI:
                                  </strong>
                                  <p className="text-gray-700 ml-2">
                                    {conv.aiResponse}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </div>

                <div className="space-y-6">
                  {userProfile && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-white rounded-2xl shadow-lg p-6"
                    >
                      <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4">
                        <User size={20} />
                        Your Profile
                      </h2>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">Name</p>
                          <p className="font-semibold">
                            {userProfile.name || "Not set"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Timezone</p>
                          <p className="font-semibold">
                            {userProfile.timezone}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Check-ins</p>
                          <p className="font-semibold">
                            {userProfile.preferences.checkIns.length > 0
                              ? userProfile.preferences.checkIns.join(", ")
                              : "Not set"}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white rounded-2xl shadow-lg p-6"
                  >
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4">
                      <History size={20} />
                      Quick Stats
                    </h2>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Sessions:</span>
                        <span className="font-semibold">
                          {conversations.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Today:</span>
                        <span className="font-semibold">{todaySessions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">This Week:</span>
                        <span className="font-semibold">{weekSessions}</span>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white rounded-2xl shadow-lg p-6"
                  >
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4">
                      <Volume2 size={20} />
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
                              isMicPermissionGranted
                                ? "bg-green-500"
                                : "bg-red-500"
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
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl shadow-lg p-6 border border-blue-100"
                  >
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4">
                      <Sparkles size={20} />
                      Tips
                    </h2>
                    <div className="space-y-3 text-sm text-gray-600">
                      <p>• Speak clearly and at a natural pace</p>
                      <p>• Ensure good microphone positioning</p>
                      <p>• Reduce background noise for better accuracy</p>
                      <p>• Allow the AI to finish speaking before responding</p>
                      <p>• Use Chrome or Edge for best compatibility</p>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <SettingsProfile />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function OnboardingQuestionnaire({
  questions,
  currentQuestion,
  data,
  onInputChange,
  onCheckboxToggle,
  onNext,
  onPrev,
  onComplete,
}: {
  questions: any[];
  currentQuestion: number;
  data: OnboardingData;
  onInputChange: (value: string | string[]) => void;
  onCheckboxToggle: (option: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onComplete: () => void;
}) {
  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 max-w-2xl w-full shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onPrev}
              disabled={currentQuestion === 0}
              className={`p-2 rounded-full ${
                currentQuestion === 0
                  ? "text-white/30 cursor-not-allowed"
                  : "text-white hover:bg-white/20"
              } transition-all duration-200`}
            >
              <ChevronLeft size={24} />
            </button>

            <div className="flex-1 mx-4">
              <div className="flex justify-between text-sm text-white/80 mb-2">
                <span>
                  Question {currentQuestion + 1} of {questions.length}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <motion.div
                  className="bg-white h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            <div className="w-8"></div>
          </div>

          <motion.h1
            key={currentQuestion}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-white mb-2"
          >
            {currentQ.question}
          </motion.h1>
          <p className="text-white/70">{currentQ.description}</p>
        </div>

        <motion.div
          key={currentQuestion}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          {currentQ.type === "textarea" && (
            <textarea
              value={
                (data[currentQ.id as keyof OnboardingData] as string) || ""
              }
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={currentQ.placeholder}
              rows={4}
              className="w-full p-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none transition-all duration-200"
            />
          )}

          {currentQ.type === "checkbox" && (
            <div className="space-y-3">
              {currentQ.options.map((option: string) => (
                <label
                  key={option}
                  className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                    data.checkInTimes.includes(option)
                      ? "bg-white/20 border-white/40"
                      : "bg-white/10 border-white/20 hover:bg-white/15"
                  } border`}
                >
                  <input
                    type="checkbox"
                    checked={data.checkInTimes.includes(option)}
                    onChange={() => onCheckboxToggle(option)}
                    className="w-5 h-5 text-blue-600 bg-white/20 border-white/30 rounded focus:ring-white/50"
                  />
                  <span className="text-white font-medium">
                    {option} Check-ins
                  </span>
                </label>
              ))}
            </div>
          )}
        </motion.div>

        <div className="flex justify-between items-center">
          <button
            onClick={onPrev}
            disabled={currentQuestion === 0}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 ${
              currentQuestion === 0
                ? "text-white/30 cursor-not-allowed"
                : "text-white hover:bg-white/20"
            }`}
          >
            <ChevronLeft size={20} />
            Previous
          </button>

          {currentQuestion === questions.length - 1 ? (
            <motion.button
              onClick={onComplete}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold text-lg flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Complete Onboarding
              <CheckCircle size={20} />
            </motion.button>
          ) : (
            <button
              onClick={onNext}
              className="bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold text-lg flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Next
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        <div className="flex justify-center gap-2 mt-8">
          {questions.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                index === currentQuestion
                  ? "bg-white"
                  : index < currentQuestion
                  ? "bg-white/60"
                  : "bg-white/30"
              }`}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function SettingsProfile() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [profile, setProfile] = useState<UserProfile>({
    id: "user_" + Date.now(),
    name: "",
    email: "",
    phone: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    onboardingAnswers: {
      whatBringsYou: "",
      challenges: "",
      supportNeeded: "",
      checkInTimes: [],
      aiPreferences: "",
    },
    preferences: {
      checkIns: [],
      callReminders: true,
      moodTracking: true,
    },
  });

  useEffect(() => {
    const loadProfileData = () => {
      try {
        const onboardingData =
          typeof window !== "undefined"
            ? localStorage.getItem("OnBoarding")
            : null;
        if (onboardingData) {
          const answers = JSON.parse(onboardingData);
          setProfile((prev) => ({
            ...prev,
            onboardingAnswers: answers,
          }));
        }

        const userProfile =
          typeof window !== "undefined"
            ? localStorage.getItem("userProfile")
            : null;
        if (userProfile) {
          const savedProfile = JSON.parse(userProfile);
          setProfile((prev) => ({ ...prev, ...savedProfile }));
        }
      } catch (error) {
        console.error("Error loading profile data:", error);
      }
    };

    loadProfileData();
  }, []);

  const timezones = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];

  const onboardingQuestions = [
    "What brings you here today?",
    "What challenges are you facing?",
    "What type of support do you need?",
    "When would you like to receive check-ins?",
    "Any preferences for your AI companion?",
  ];

  const handleInputChange = (field: string, value: any) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreferenceChange = (
    field: keyof UserProfile["preferences"],
    value: any
  ) => {
    setProfile((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, [field]: value },
    }));
  };

  const handleCheckInToggle = (time: string) => {
    setProfile((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        checkIns: prev.preferences.checkIns.includes(time)
          ? prev.preferences.checkIns.filter((t) => t !== time)
          : [...prev.preferences.checkIns, time],
      },
    }));
  };

  const handleOnboardingAnswerChange = (question: string, value: string) => {
    setProfile((prev) => ({
      ...prev,
      onboardingAnswers: { ...prev.onboardingAnswers, [question]: value },
    }));
  };

  const triggerN8nWebhook = async (eventType: string, data: any) => {
    try {
      const webhookData = {
        eventType,
        userId: profile.id,
        timestamp: new Date().toISOString(),
        userProfile: profile,
        ...data,
      };

      const response = await fetch(process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(webhookData),
      });

      return response.ok;
    } catch (error) {
      console.error("Webhook error:", error);
      return false;
    }
  };

  const handleSaveChanges = async () => {
    setIsLoading(true);
    setSaveStatus("saving");

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("userProfile", JSON.stringify(profile));
      }

      const webhookSuccess = await triggerN8nWebhook("profile_updated", {
        action: "profile_update",
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        timezone: profile.timezone,
        preferences: profile.preferences,
        updatedOnboardingAnswers: profile.onboardingAnswers,
      });

      if (webhookSuccess) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      setSaveStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-60 -right-20 w-60 h-60 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      <div className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Profile Settings
            </h1>
            <p className="text-gray-300 mt-2">
              Manage your account and preferences
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-6 shadow-2xl glow"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-blue-500/20">
                  <User className="w-6 h-6 text-blue-300" />
                </div>
                <h2 className="text-2xl font-semibold">Account Information</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) =>
                        handleInputChange("phone", e.target.value)
                      }
                      className="w-full p-3 pl-10 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Timezone
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <select
                      value={profile.timezone}
                      onChange={(e) =>
                        handleInputChange("timezone", e.target.value)
                      }
                      className="w-full p-3 pl-10 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 appearance-none"
                    >
                      {timezones.map((tz) => (
                        <option key={tz} value={tz} className="bg-gray-800">
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-6 shadow-2xl glow"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-green-500/20">
                  <MessageSquare className="w-6 h-6 text-green-300" />
                </div>
                <h2 className="text-2xl font-semibold">Your Responses</h2>
              </div>

              <div className="space-y-4">
                {onboardingQuestions.map((question, index) => (
                  <div key={index} className="bg-white/5 rounded-xl p-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {question}
                    </label>
                    {question ===
                    "When would you like to receive check-ins?" ? (
                      <div className="flex flex-wrap gap-2">
                        {["Morning", "Evening", "Sunday"].map((time) => (
                          <button
                            key={time}
                            onClick={() => {
                              const currentAnswers =
                                profile.onboardingAnswers[question] || {};
                              handleOnboardingAnswerChange(question, {
                                ...currentAnswers,
                                [time]: !currentAnswers[time],
                              });
                            }}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                              profile.onboardingAnswers[question]?.[time]
                                ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                                : "bg-white/10 text-gray-300 hover:bg-white/20"
                            }`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={profile.onboardingAnswers[question] || ""}
                        onChange={(e) =>
                          handleOnboardingAnswerChange(question, e.target.value)
                        }
                        rows={2}
                        className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200"
                        placeholder="Your response..."
                      />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-6 shadow-2xl glow"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-purple-500/20">
                  <Bell className="w-6 h-6 text-purple-300" />
                </div>
                <h2 className="text-2xl font-semibold">Preferences</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    Check-in Times
                  </h3>
                  <div className="space-y-2">
                    {["Morning", "Evening", "Sunday"].map((time) => (
                      <label
                        key={time}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={profile.preferences.checkIns.includes(time)}
                          onChange={() => handleCheckInToggle(time)}
                          className="w-4 h-4 text-cyan-500 bg-white/10 border-white/20 rounded focus:ring-cyan-500"
                        />
                        <span className="flex-1">{time} Check-ins</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-green-400" />
                      <span>Call Reminders</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.preferences.callReminders}
                      onChange={(e) =>
                        handlePreferenceChange(
                          "callReminders",
                          e.target.checked
                        )
                      }
                      className="w-4 h-4 text-cyan-500 bg-white/10 border-white/20 rounded focus:ring-cyan-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Heart className="w-5 h-5 text-pink-400" />
                      <span>Mood Tracking</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.preferences.moodTracking}
                      onChange={(e) =>
                        handlePreferenceChange("moodTracking", e.target.checked)
                      }
                      className="w-4 h-4 text-cyan-500 bg-white/10 border-white/20 rounded focus:ring-cyan-500"
                    />
                  </label>
                </div>
              </div>
            </motion.div>

            <motion.button
              onClick={handleSaveChanges}
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full p-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-2xl ${
                saveStatus === "success"
                  ? "bg-green-500 hover:bg-green-600"
                  : saveStatus === "error"
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              } flex items-center justify-center gap-3`}
            >
              {saveStatus === "saving" ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : saveStatus === "success" ? (
                <>
                  <CheckCircle className="w-6 h-6" />
                  Saved Successfully!
                </>
              ) : saveStatus === "error" ? (
                <>Error Saving</>
              ) : (
                <>
                  <Save className="w-6 h-6" />
                  Save Changes
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .glow {
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.1),
            0 0 40px rgba(59, 130, 246, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
        .glow:hover {
          box-shadow: 0 0 30px rgba(59, 130, 246, 0.2),
            0 0 60px rgba(59, 130, 246, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
