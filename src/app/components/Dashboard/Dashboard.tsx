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
  Mail,
  Calendar,
  Brain,
  BookOpen,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface ConversationEntry {
  id: string;
  timestamp: Date;
  userMessage: string;
  aiResponse: string;
  mood?: string;
  sentiment?: number;
  topics?: string[];
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
  freeTime: string[];
  contactPreference: "email" | "phone" | "both";
  onboardingAnswers: {
    whatBringsYou: string;
    challenges: string;
    supportNeeded: string;
    checkInTimes: string[];
    aiPreferences: string;
    contactEmail: string;
    contactPhone: string;
    freeTimeSlots: string[];
    contactMethod: "email" | "phone" | "both";
  };
  preferences: {
    checkIns: string[];
    callReminders: boolean;
    moodTracking: boolean;
    sessionProgress: boolean;
    contextAwareness: boolean;
  };
  conversationContext: {
    recentTopics: string[];
    emotionalState: string;
    sessionProgress: number;
    lastSessionDate?: Date;
  };
}

interface OnboardingData {
  whatBringsYou: string;
  challenges: string;
  supportNeeded: string;
  checkInTimes: string[];
  aiPreferences: string;
  contactEmail: string;
  contactPhone: string;
  freeTimeSlots: string[];
  contactMethod: "email" | "phone" | "both";
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
    contactEmail: "",
    contactPhone: "",
    freeTimeSlots: [],
    contactMethod: "email",
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
  const [sessionProgress, setSessionProgress] = useState(0);
  const [conversationContext, setConversationContext] = useState<string[]>([]);

  const settings = {
    voice: "alloy",
    speed: 1.0,
    moodTracking: true,
    contextAwareness: true,
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
          const profile = JSON.parse(savedProfile);
          setUserProfile(profile);
          setConversationContext(
            profile.conversationContext?.recentTopics || []
          );
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
      icon: <BookOpen className="w-5 h-5" />,
    },
    {
      id: "challenges",
      question: "What challenges are you facing?",
      description: "Share what's been difficult lately",
      type: "textarea",
      placeholder: "I've been struggling with...",
      icon: <AlertCircle className="w-5 h-5" />,
    },
    {
      id: "supportNeeded",
      question: "What type of support do you need?",
      description: "How can we best help you?",
      type: "textarea",
      placeholder: "I need help with...",
      icon: <Heart className="w-5 h-5" />,
    },
    {
      id: "userName",
      question: "What's your Name?",
      description: "We'll use this to contact you for follow-ups",
      type: "name",
      placeholder: "Hasan Al Banna",
      icon: <Phone className="w-5 h-5" />,
    },
    {
      id: "contactEmail",
      question: "What's your email address?",
      description: "We'll use this to contact you for follow-ups",
      type: "email",
      placeholder: "your.email@example.com",
      icon: <Mail className="w-5 h-5" />,
    },
    {
      id: "contactPhone",
      question: "What's your phone number?",
      description: "For important updates and check-ins",
      type: "tel",
      placeholder: "+1 (555) 123-4567",
      icon: <Phone className="w-5 h-5" />,
    },
    {
      id: "contactMethod",
      question: "How would you prefer to be contacted?",
      description: "Choose your preferred contact method",
      type: "radio",
      options: [
        { value: "email", label: "Email only" },
        { value: "phone", label: "Phone only" },
        { value: "both", label: "Both email and phone" },
      ],
      icon: <Bell className="w-5 h-5" />,
    },
    {
      id: "freeTimeSlots",
      question: "When are you usually available?",
      description: "Select times when you're free for conversations",
      type: "checkbox",
      options: [
        "Morning (8-11 AM)",
        "Afternoon (12-4 PM)",
        "Evening (5-8 PM)",
        "Weekends",
      ],
      icon: <Clock className="w-5 h-5" />,
    },
    {
      id: "checkInTimes",
      question: "When would you like to receive check-ins?",
      description: "Select your preferred times for wellness check-ins",
      type: "checkbox",
      options: ["Daily Morning", "Daily Evening", "Weekly", "Bi-weekly"],
      icon: <Calendar className="w-5 h-5" />,
    },
    {
      id: "aiPreferences",
      question: "Any preferences for your AI companion?",
      description:
        "Voice style, tone, or anything else that would make you comfortable",
      type: "textarea",
      placeholder: "I prefer a companion that is...",
      icon: <Brain className="w-5 h-5" />,
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
    const currentField = onboardingQuestions[currentQuestion]
      .id as keyof OnboardingData;
    const currentValues = onboardingData[currentField] as string[];
    const updatedValues = currentValues.includes(option)
      ? currentValues.filter((time) => time !== option)
      : [...currentValues, option];

    handleOnboardingInputChange(updatedValues);
  };

  const handleRadioSelect = (value: string) => {
    handleOnboardingInputChange(value);
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
      const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

      // If no webhook URL is set, use the local API route as default
      const defaultWebhookUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/api/webhook`
          : "https://voice-agent-phi-virid.vercel.app/api/webhook";

      const finalWebhookUrl = webhookUrl || defaultWebhookUrl;

      // Validate URL
      if (
        !finalWebhookUrl ||
        finalWebhookUrl.includes("undefined") ||
        finalWebhookUrl.includes("your_single_n8n_webhook_url_here")
      ) {
        console.warn("⚠️ Webhook URL not properly configured, using default");
        return true; // Don't break the app
      }

      const completeData = {
        eventType,
        timestamp: new Date().toISOString(),
        userProfile: userProfile || {
          id: "user_" + Date.now(),
          name: "",
          email: onboardingData.contactEmail,
          phone: onboardingData.contactPhone,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          freeTime: onboardingData.freeTimeSlots,
          contactPreference: onboardingData.contactMethod,
          onboardingAnswers: onboardingData,
          preferences: {
            checkIns: onboardingData.checkInTimes || [],
            callReminders: true,
            moodTracking: true,
            sessionProgress: true,
            contextAwareness: true,
          },
          conversationContext: {
            recentTopics: conversationContext,
            emotionalState: "neutral",
            sessionProgress: sessionProgress,
            lastSessionDate: new Date(),
          },
        },
        onboardingData: onboardingData,
        conversations: conversations.slice(-5), // Send last 5 conversations for context
        currentSessionProgress: sessionProgress,
        conversationContext: conversationContext,
        appVersion: "2.0.0",
        source: "voice-mood-dashboard",
        ...data,
      };

      console.log(`📤 Sending ${eventType} to:`, finalWebhookUrl);
      console.log("📊 Webhook payload:", completeData);

      const response = await fetch(finalWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(completeData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log("✅ Webhook successful:", result);

      return true;
    } catch (error) {
      console.error("❌ Webhook failed:", error);
      // Don't break the user experience if webhook fails
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
          email: onboardingData.contactEmail,
          phone: onboardingData.contactPhone,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          freeTime: onboardingData.freeTimeSlots,
          contactPreference: onboardingData.contactMethod,
          preferences: {
            checkIns: onboardingData.checkInTimes,
            callReminders: true,
            moodTracking: true,
            sessionProgress: true,
            contextAwareness: true,
          },
          conversationContext: {
            recentTopics: [],
            emotionalState: "neutral",
            sessionProgress: 0,
            lastSessionDate: new Date(),
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
    setSessionProgress(0);

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
        sessionStartTime: new Date().toISOString(),
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
    setSessionProgress(100);
    stopSpeechRecognition();
    stopSpeechSynthesis();
    cleanupAudioAnalysis();

    triggerN8nWebhook("call_ended", {
      action: "call_end",
      conversationCount: conversations.length,
      lastSession: conversations[0] || null,
      userProfile: userProfile,
      sessionProgress: sessionProgress,
      conversationContext: conversationContext,
      sessionEndTime: new Date().toISOString(),
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

  const extractTopics = (text: string): string[] => {
    const topics = [];
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes("work") ||
      lowerText.includes("job") ||
      lowerText.includes("career")
    ) {
      topics.push("work");
    }
    if (
      lowerText.includes("family") ||
      lowerText.includes("parent") ||
      lowerText.includes("child")
    ) {
      topics.push("family");
    }
    if (
      lowerText.includes("friend") ||
      lowerText.includes("social") ||
      lowerText.includes("lonely")
    ) {
      topics.push("social");
    }
    if (
      lowerText.includes("health") ||
      lowerText.includes("sick") ||
      lowerText.includes("pain")
    ) {
      topics.push("health");
    }
    if (
      lowerText.includes("stress") ||
      lowerText.includes("anxiety") ||
      lowerText.includes("worry")
    ) {
      topics.push("stress");
    }
    if (
      lowerText.includes("sleep") ||
      lowerText.includes("tired") ||
      lowerText.includes("energy")
    ) {
      topics.push("sleep");
    }
    if (
      lowerText.includes("happy") ||
      lowerText.includes("excited") ||
      lowerText.includes("good")
    ) {
      topics.push("positive");
    }
    if (
      lowerText.includes("sad") ||
      lowerText.includes("upset") ||
      lowerText.includes("bad")
    ) {
      topics.push("negative");
    }

    return topics.slice(0, 3);
  };

  const processUserMessage = async (message: string) => {
    if (!message.trim() || message.length < 2) return;

    // Update session progress
    setSessionProgress((prev) => Math.min(prev + 10, 100));

    // Extract and update conversation context
    const newTopics = extractTopics(message);
    setConversationContext((prev) => {
      const updated = [...prev, ...newTopics];
      return Array.from(new Set(updated)).slice(-10); // Keep last 10 unique topics
    });

    const getContextAwareResponse = (
      userMessage: string,
      context: string[]
    ): string => {
      const lowerMessage = userMessage.toLowerCase();
      const hasPreviousContext = context.length > 0;

      if (hasPreviousContext) {
        const recentTopics = context.slice(-3).join(", ");

        if (
          lowerMessage.includes("remember") ||
          lowerMessage.includes("before")
        ) {
          return `I remember we talked about ${recentTopics}. I'm here to continue supporting you with those topics. How are things going with that now?`;
        }

        if (
          context.includes("stress") &&
          (lowerMessage.includes("better") || lowerMessage.includes("improve"))
        ) {
          return "I'm glad to hear you're working on managing stress. Remember the techniques we discussed? How are they helping you?";
        }

        if (context.includes("work") && lowerMessage.includes("today")) {
          return "Since we've talked about work before, I'd love to hear how your day went. Any specific challenges or successes?";
        }
      }

      // Fallback responses
      if (
        lowerMessage.includes("hello") ||
        lowerMessage.includes("hi") ||
        lowerMessage.includes("hey")
      ) {
        return hasPreviousContext
          ? "Welcome back! I remember our previous conversation. How have you been since we last spoke?"
          : "Hello! It's great to meet you. I'm here to listen and support you. What would you like to talk about today?";
      }

      if (lowerMessage.includes("how are you")) {
        return "I'm functioning well, thank you for asking! I'm here to chat with you. What's on your mind today?";
      }

      if (lowerMessage.includes("thank")) {
        return "You're very welcome! I'm glad I could help. Remember, I'm always here to listen. Is there anything else you'd like to discuss?";
      }

      if (
        lowerMessage.includes("sad") ||
        lowerMessage.includes("upset") ||
        lowerMessage.includes("unhappy")
      ) {
        return "I'm sorry to hear you're feeling this way. It takes courage to share these feelings. Would you like to talk more about what's bothering you?";
      }

      if (
        lowerMessage.includes("happy") ||
        lowerMessage.includes("excited") ||
        lowerMessage.includes("good")
      ) {
        return "That's wonderful to hear! I'm glad you're feeling positive. What's been making you feel this way? I'd love to hear more!";
      }

      return hasPreviousContext
        ? `Thank you for sharing that. Building on our previous conversation about ${context
            .slice(-2)
            .join(
              " and "
            )}, I'm here to support you further. What else would you like to discuss?`
        : "Thank you for sharing that with me. I'm here to listen and help however I can. What else is on your mind?";
    };

    try {
      const context = conversationContext;
      const systemPrompt = `You are a helpful and empathetic AI assistant. ${
        context.length > 0
          ? `The user has previously discussed: ${context.join(
              ", "
            )}. Use this context to provide more personalized responses. `
          : ""
      }Analyze the user's mood from their message and respond appropriately. Keep responses conversational and under 100 words. Be engaging, supportive, and remember previous context when relevant.`;

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
                content: systemPrompt,
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
      const topics = extractTopics(message);

      const newEntry: ConversationEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        userMessage: message,
        aiResponse: aiResponse,
        mood: mood,
        sentiment: mood === "positive" ? 1 : mood === "negative" ? -1 : 0,
        topics: topics,
      };

      setConversations((prev) => [newEntry, ...prev.slice(0, 49)]);

      // Update user profile with new context
      if (userProfile) {
        const updatedProfile = {
          ...userProfile,
          conversationContext: {
            recentTopics: [...conversationContext, ...topics].slice(-10),
            emotionalState: mood,
            sessionProgress: sessionProgress + 10,
            lastSessionDate: new Date(),
          },
        };
        setUserProfile(updatedProfile);
        localStorage.setItem("userProfile", JSON.stringify(updatedProfile));
      }

      await triggerN8nWebhook("conversation_entry", {
        action: "new_conversation",
        conversation: newEntry,
        userProfile: userProfile,
        totalConversations: conversations.length + 1,
        contextUsed: context,
        sessionProgress: sessionProgress + 10,
      });

      speakText(aiResponse);
    } catch (error) {
      console.error("Error calling OpenRouter API:", error);
      const fallbackResponse = getContextAwareResponse(
        message,
        conversationContext
      );
      const mood = detectMood(message);
      const topics = extractTopics(message);

      const newEntry: ConversationEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        userMessage: message,
        aiResponse: fallbackResponse,
        mood: mood,
        sentiment: mood === "positive" ? 1 : mood === "negative" ? -1 : 0,
        topics: topics,
      };

      setConversations((prev) => [newEntry, ...prev]);

      await triggerN8nWebhook("conversation_entry_fallback", {
        action: "fallback_conversation",
        conversation: newEntry,
        userProfile: userProfile,
        error: "OpenRouter API failed, using fallback response",
        contextUsed: conversationContext,
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
      "better",
      "improved",
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
      "anxious",
      "worried",
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
    setConversationContext([]);
    setSessionProgress(0);
    typeof window !== "undefined" &&
      localStorage.removeItem("voice-mood-conversations");

    if (userProfile) {
      const updatedProfile = {
        ...userProfile,
        conversationContext: {
          recentTopics: [],
          emotionalState: "neutral",
          sessionProgress: 0,
          lastSessionDate: new Date(),
        },
      };
      setUserProfile(updatedProfile);
      localStorage.setItem("userProfile", JSON.stringify(updatedProfile));
    }

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
        onRadioSelect={handleRadioSelect}
        onNext={nextQuestion}
        onPrev={prevQuestion}
        onComplete={completeOnboarding}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 font-sans">
      <div className="max-w-7xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="relative inline-block">
            <h1 className="text-5xl font-bold text-gray-800 mb-2 font-handwritten bg-white/80 px-6 py-3 rounded-2xl shadow-lg border-2 border-blue-200">
              GPT Voice Mood
            </h1>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full animate-bounce"></div>
            <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-pink-400 rounded-full animate-pulse"></div>
          </div>
          <p className="text-gray-600 text-lg font-handwritten">
            Your AI companion for mood tracking and conversation
          </p>
        </motion.header>

        {/* Session Progress Bar */}
        {isCallActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border-2 border-green-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 font-handwritten">
                Session Progress
              </span>
              <span className="text-sm font-bold text-green-600">
                {sessionProgress}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <motion.div
                className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full shadow-inner"
                initial={{ width: 0 }}
                animate={{ width: `${sessionProgress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Started</span>
              <span>In Progress</span>
              <span>Complete</span>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mb-8"
        >
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-2 shadow-lg border-2 border-purple-200">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 font-handwritten ${
                  activeTab === "dashboard"
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg border-2 border-white/30"
                    : "text-gray-600 hover:text-gray-800 hover:bg-white/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 size={20} />
                  Dashboard
                </div>
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 font-handwritten ${
                  activeTab === "settings"
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg border-2 border-white/30"
                    : "text-gray-600 hover:text-gray-800 hover:bg-white/50"
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
                  className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3 shadow-lg"
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
                    className="bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-200 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-200 rounded-full -mr-10 -mt-10 opacity-60"></div>
                    <div className="absolute bottom-0 left-0 w-16 h-16 bg-green-200 rounded-full -ml-8 -mb-8 opacity-60"></div>

                    <div className="text-center relative z-10">
                      {!isCallActive ? (
                        <div className="space-y-4">
                          <motion.button
                            onClick={startCall}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-4 rounded-full font-semibold text-lg flex items-center justify-center mx-auto gap-3 transition-all duration-200 shadow-lg shadow-green-500/30 border-2 border-white/30 font-handwritten"
                          >
                            <Phone size={24} />
                            Start Voice Session
                          </motion.button>
                          <p className="text-sm text-gray-500 font-handwritten">
                            Click to start a conversation with AI voice
                            assistant
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center justify-center gap-4">
                            <div
                              className={`p-3 rounded-full border-2 ${
                                isListening
                                  ? "bg-green-100 text-green-600 animate-pulse border-green-300"
                                  : "bg-gray-100 text-gray-400 border-gray-300"
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
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden border">
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                                    style={{ width: `${audioLevel * 100}%` }}
                                    animate={{ width: `${audioLevel * 100}%` }}
                                    transition={{ duration: 0.1 }}
                                  />
                                </div>
                                <span className="text-sm text-gray-600 font-handwritten">
                                  {Math.round(audioLevel * 100)}%
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 text-center font-handwritten">
                                {getMicStatusText()}
                              </p>
                            </div>
                            <div
                              className={`p-3 rounded-full border-2 ${
                                isSpeaking
                                  ? "bg-blue-100 text-blue-600 animate-pulse border-blue-300"
                                  : "bg-gray-100 text-gray-400 border-gray-300"
                              }`}
                            >
                              <Volume2 size={24} />
                            </div>
                          </div>

                          <motion.button
                            onClick={endCall}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white px-8 py-4 rounded-full font-semibold text-lg flex items-center justify-center mx-auto gap-3 transition-all duration-200 shadow-lg shadow-red-500/30 border-2 border-white/30 font-handwritten"
                          >
                            <PhoneOff size={24} />
                            End Call
                          </motion.button>

                          <div className="text-xs text-gray-500 space-y-1 font-handwritten">
                            <p>💡 Speak clearly into your microphone</p>
                            <p>💡 Ensure you're in a quiet environment</p>
                            <p>
                              💡 I remember our previous conversations for
                              context
                            </p>
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
                    className="bg-white rounded-2xl shadow-lg p-6 border-2 border-purple-200 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-12 h-12 bg-pink-200 rounded-full -ml-6 -mt-6 opacity-50"></div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 font-handwritten">
                        <BarChart3 size={20} />
                        Progress Insights
                      </h2>
                      {conversations.length > 0 && (
                        <motion.button
                          onClick={clearHistory}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="text-sm text-red-500 hover:text-red-700 px-3 py-1 rounded border-2 border-red-200 hover:border-red-300 transition-all duration-200 font-handwritten"
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
                        <p className="font-handwritten">
                          No conversations yet. Start a session to begin
                          tracking!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="bg-green-50 rounded-lg p-4 text-center border-2 border-green-100 shadow-sm"
                          >
                            <div className="text-2xl font-bold text-green-600">
                              {positiveSessions}
                            </div>
                            <div className="text-sm text-green-600 font-handwritten">
                              Positive
                            </div>
                          </motion.div>
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="bg-blue-50 rounded-lg p-4 text-center border-2 border-blue-100 shadow-sm"
                          >
                            <div className="text-2xl font-bold text-blue-600">
                              {neutralSessions}
                            </div>
                            <div className="text-sm text-blue-600 font-handwritten">
                              Neutral
                            </div>
                          </motion.div>
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="bg-red-50 rounded-lg p-4 text-center border-2 border-red-100 shadow-sm"
                          >
                            <div className="text-2xl font-bold text-red-600">
                              {negativeSessions}
                            </div>
                            <div className="text-sm text-red-600 font-handwritten">
                              Negative
                            </div>
                          </motion.div>
                        </div>

                        {conversationContext.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Brain size={16} className="text-yellow-600" />
                              <span className="text-sm font-medium text-yellow-800 font-handwritten">
                                Conversation Context
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {conversationContext
                                .slice(-5)
                                .map((topic, index) => (
                                  <span
                                    key={index}
                                    className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-handwritten border border-yellow-200"
                                  >
                                    {topic}
                                  </span>
                                ))}
                            </div>
                          </motion.div>
                        )}

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {conversations.map((conv, index) => (
                            <motion.div
                              key={conv.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="border-2 rounded-lg p-4 hover:bg-gray-50 transition-colors border-gray-200 shadow-sm"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-500 font-handwritten">
                                  {new Date(conv.timestamp).toLocaleString()}
                                </span>
                                <div className="flex items-center gap-2">
                                  {conv.topics && conv.topics.length > 0 && (
                                    <div className="flex gap-1">
                                      {conv.topics
                                        .slice(0, 2)
                                        .map((topic, i) => (
                                          <span
                                            key={i}
                                            className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-handwritten"
                                          >
                                            {topic}
                                          </span>
                                        ))}
                                    </div>
                                  )}
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                      conv.mood === "positive"
                                        ? "bg-green-100 text-green-800 border-green-200"
                                        : conv.mood === "negative"
                                        ? "bg-red-100 text-red-800 border-red-200"
                                        : "bg-blue-100 text-blue-800 border-blue-200"
                                    } font-handwritten`}
                                  >
                                    {conv.mood}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <strong className="text-blue-600 font-handwritten">
                                    You:
                                  </strong>
                                  <p className="text-gray-700 ml-2 font-handwritten">
                                    {conv.userMessage}
                                  </p>
                                </div>
                                <div>
                                  <strong className="text-green-600 font-handwritten">
                                    AI:
                                  </strong>
                                  <p className="text-gray-700 ml-2 font-handwritten">
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
                      className="bg-white rounded-2xl shadow-lg p-6 border-2 border-green-200 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-blue-200 rounded-full -mr-8 -mt-8 opacity-50"></div>
                      <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4 font-handwritten">
                        <User size={20} />
                        Your Profile
                      </h2>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600 font-handwritten">
                            Name
                          </p>
                          <p className="font-semibold font-handwritten">
                            {userProfile.name || "Not set"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 font-handwritten">
                            Email
                          </p>
                          <p className="font-semibold font-handwritten">
                            {userProfile.email || "Not set"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 font-handwritten">
                            Phone
                          </p>
                          <p className="font-semibold font-handwritten">
                            {userProfile.phone || "Not set"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 font-handwritten">
                            Contact Preference
                          </p>
                          <p className="font-semibold font-handwritten capitalize">
                            {userProfile.contactPreference}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 font-handwritten">
                            Free Time
                          </p>
                          <p className="font-semibold font-handwritten">
                            {userProfile.freeTime.length > 0
                              ? userProfile.freeTime.join(", ")
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
                    className="bg-white rounded-2xl shadow-lg p-6 border-2 border-yellow-200 relative overflow-hidden"
                  >
                    <div className="absolute bottom-0 right-0 w-12 h-12 bg-purple-200 rounded-full -mr-6 -mb-6 opacity-50"></div>
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4 font-handwritten">
                      <History size={20} />
                      Quick Stats
                    </h2>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600 font-handwritten">
                          Total Sessions:
                        </span>
                        <span className="font-semibold font-handwritten">
                          {conversations.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 font-handwritten">
                          Today:
                        </span>
                        <span className="font-semibold font-handwritten">
                          {todaySessions}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 font-handwritten">
                          This Week:
                        </span>
                        <span className="font-semibold font-handwritten">
                          {weekSessions}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 font-handwritten">
                          Context Memory:
                        </span>
                        <span className="font-semibold font-handwritten">
                          {conversationContext.length} topics
                        </span>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-200 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-10 h-10 bg-green-200 rounded-full -ml-5 -mt-5 opacity-50"></div>
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4 font-handwritten">
                      <Volume2 size={20} />
                      Voice Settings
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 font-handwritten">
                          Speech Speed
                        </label>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500 font-handwritten">
                            Slow
                          </span>
                          <input
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.1"
                            value={settings.speed}
                            className="flex-1"
                            readOnly
                          />
                          <span className="text-sm text-gray-500 font-handwritten">
                            Fast
                          </span>
                        </div>
                        <p className="text-center text-sm text-gray-600 mt-1 font-handwritten">
                          {settings.speed}x
                        </p>
                      </div>
                      <div className="pt-4 border-t border-gray-200">
                        <h3 className="font-medium text-gray-700 mb-3 font-handwritten">
                          Features
                        </h3>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 font-handwritten">
                              Context Awareness
                            </span>
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 font-handwritten">
                              Session Progress
                            </span>
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 font-handwritten">
                              Mood Tracking
                            </span>
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl shadow-lg p-6 border-2 border-cyan-200 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-14 h-14 bg-cyan-200 rounded-full -mr-7 -mt-7 opacity-50"></div>
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4 font-handwritten">
                      <Sparkles size={20} />
                      Tips
                    </h2>
                    <div className="space-y-3 text-sm text-gray-600 font-handwritten">
                      <p>• Speak clearly and at a natural pace</p>
                      <p>• I remember previous conversations for context</p>
                      <p>• Reduce background noise for better accuracy</p>
                      <p>• Allow me to finish speaking before responding</p>
                      <p>• Use Chrome or Edge for best compatibility</p>
                      <p>
                        • Session progress helps track our conversation depth
                      </p>
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
  onRadioSelect,
  onNext,
  onPrev,
  onComplete,
}: {
  questions: any[];
  currentQuestion: number;
  data: OnboardingData;
  onInputChange: (value: string | string[]) => void;
  onCheckboxToggle: (option: string) => void;
  onRadioSelect: (value: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onComplete: () => void;
}) {
  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestion === questions.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 flex items-center justify-center p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/10 backdrop-blur-md rounded-3xl border-2 border-white/20 p-8 max-w-2xl w-full shadow-2xl relative overflow-hidden"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-20 h-20 bg-pink-300 rounded-full -ml-10 -mt-10 opacity-40"></div>
        <div className="absolute bottom-0 right-0 w-16 h-16 bg-yellow-300 rounded-full -mr-8 -mb-8 opacity-40"></div>
        <div className="absolute top-1/2 right-10 w-8 h-8 bg-green-300 rounded-full opacity-60"></div>

        <div className="text-center mb-8 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onPrev}
              disabled={currentQuestion === 0}
              className={`p-2 rounded-full border-2 ${
                currentQuestion === 0
                  ? "text-white/30 cursor-not-allowed border-white/20"
                  : "text-white hover:bg-white/20 border-white/40"
              } transition-all duration-200`}
            >
              <ChevronLeft size={24} />
            </button>

            <div className="flex-1 mx-4">
              <div className="flex justify-between text-sm text-white/80 mb-2 font-handwritten">
                <span>
                  Question {currentQuestion + 1} of {questions.length}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3 border border-white/30">
                <motion.div
                  className="bg-white h-3 rounded-full shadow-lg"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            <div className="w-8"></div>
          </div>

          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-3 mb-4"
          >
            <div className="p-2 bg-white/20 rounded-xl border border-white/30">
              {currentQ.icon}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 font-handwritten">
                {currentQ.question}
              </h1>
              <p className="text-white/70 font-handwritten">
                {currentQ.description}
              </p>
            </div>
          </motion.div>
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
              className="w-full p-4 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none transition-all duration-200 font-handwritten"
            />
          )}

          {currentQ.type === "email" && (
            <input
              type="email"
              value={
                (data[currentQ.id as keyof OnboardingData] as string) || ""
              }
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={currentQ.placeholder}
              className="w-full p-4 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200 font-handwritten"
            />
          )}

          {currentQ.type === "tel" && (
            <input
              type="tel"
              value={
                (data[currentQ.id as keyof OnboardingData] as string) || ""
              }
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={currentQ.placeholder}
              className="w-full p-4 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200 font-handwritten"
            />
          )}

          {currentQ.type === "checkbox" && (
            <div className="space-y-3">
              {currentQ.options.map((option: string) => (
                <label
                  key={option}
                  className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                    (
                      data[currentQ.id as keyof OnboardingData] as string[]
                    )?.includes(option)
                      ? "bg-white/20 border-white/40 shadow-lg"
                      : "bg-white/10 border-white/20 hover:bg-white/15"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={
                      (
                        data[currentQ.id as keyof OnboardingData] as string[]
                      )?.includes(option) || false
                    }
                    onChange={() => onCheckboxToggle(option)}
                    className="w-5 h-5 text-blue-600 bg-white/20 border-white/30 rounded focus:ring-white/50"
                  />
                  <span className="text-white font-medium font-handwritten">
                    {option}
                  </span>
                </label>
              ))}
            </div>
          )}

          {currentQ.type === "radio" && (
            <div className="space-y-3">
              {currentQ.options.map((option: any) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                    data.contactMethod === option.value
                      ? "bg-white/20 border-white/40 shadow-lg"
                      : "bg-white/10 border-white/20 hover:bg-white/15"
                  }`}
                >
                  <input
                    type="radio"
                    name="contactMethod"
                    value={option.value}
                    checked={data.contactMethod === option.value}
                    onChange={() => onRadioSelect(option.value)}
                    className="w-5 h-5 text-blue-600 bg-white/20 border-white/30 focus:ring-white/50"
                  />
                  <span className="text-white font-medium font-handwritten">
                    {option.label}
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
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 border-2 ${
              currentQuestion === 0
                ? "text-white/30 cursor-not-allowed border-white/20"
                : "text-white hover:bg-white/20 border-white/40"
            } font-handwritten`}
          >
            <ChevronLeft size={20} />
            Previous
          </button>

          {isLastQuestion ? (
            <motion.button
              onClick={onComplete}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold text-lg flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl border-2 border-white/30 font-handwritten"
            >
              Complete Onboarding
              <CheckCircle size={20} />
            </motion.button>
          ) : (
            <button
              onClick={onNext}
              className="bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold text-lg flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl border-2 border-white/30 font-handwritten"
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
              className={`w-2 h-2 rounded-full transition-all duration-200 border ${
                index === currentQuestion
                  ? "bg-white border-white"
                  : index < currentQuestion
                  ? "bg-white/60 border-white/40"
                  : "bg-white/30 border-white/20"
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
    freeTime: [],
    contactPreference: "email",
    onboardingAnswers: {
      whatBringsYou: "",
      challenges: "",
      supportNeeded: "",
      checkInTimes: [],
      aiPreferences: "",
      contactEmail: "",
      contactPhone: "",
      freeTimeSlots: [],
      contactMethod: "email",
    },
    preferences: {
      checkIns: [],
      callReminders: true,
      moodTracking: true,
      sessionProgress: true,
      contextAwareness: true,
    },
    conversationContext: {
      recentTopics: [],
      emotionalState: "neutral",
      sessionProgress: 0,
      lastSessionDate: new Date(),
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
            email: answers.contactEmail || "",
            phone: answers.contactPhone || "",
            freeTime: answers.freeTimeSlots || [],
            contactPreference: answers.contactMethod || "email",
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

  const freeTimeOptions = [
    "Morning (8-11 AM)",
    "Afternoon (12-4 PM)",
    "Evening (5-8 PM)",
    "Weekends",
  ];
  const checkInOptions = [
    "Daily Morning",
    "Daily Evening",
    "Weekly",
    "Bi-weekly",
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

  const handleFreeTimeToggle = (time: string) => {
    setProfile((prev) => ({
      ...prev,
      freeTime: prev.freeTime.includes(time)
        ? prev.freeTime.filter((t) => t !== time)
        : [...prev.freeTime, time],
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
      const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

      // If no webhook URL is set, use the local API route as default
      const defaultWebhookUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/api/webhook`
          : "https://voice-agent-phi-virid.vercel.app/api/webhook";

      const finalWebhookUrl = webhookUrl || defaultWebhookUrl;

      // Validate URL
      if (
        !finalWebhookUrl ||
        finalWebhookUrl.includes("undefined") ||
        finalWebhookUrl.includes("your_single_n8n_webhook_url_here")
      ) {
        console.warn("⚠️ Webhook URL not properly configured, using default");
        return true; // Don't break the app
      }

      const completeData = {
        eventType,
        timestamp: new Date().toISOString(),
        userProfile: userProfile || {
          id: "user_" + Date.now(),
          name: "",
          email: onboardingData.contactEmail,
          phone: onboardingData.contactPhone,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          freeTime: onboardingData.freeTimeSlots,
          contactPreference: onboardingData.contactMethod,
          onboardingAnswers: onboardingData,
          preferences: {
            checkIns: onboardingData.checkInTimes || [],
            callReminders: true,
            moodTracking: true,
            sessionProgress: true,
            contextAwareness: true,
          },
          conversationContext: {
            recentTopics: conversationContext,
            emotionalState: "neutral",
            sessionProgress: sessionProgress,
            lastSessionDate: new Date(),
          },
        },
        onboardingData: onboardingData,
        conversations: conversations.slice(-5), // Send last 5 conversations for context
        currentSessionProgress: sessionProgress,
        conversationContext: conversationContext,
        appVersion: "2.0.0",
        source: "voice-mood-dashboard",
        ...data,
      };

      console.log(`📤 Sending ${eventType} to:`, finalWebhookUrl);
      console.log("📊 Webhook payload:", completeData);

      const response = await fetch(finalWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(completeData),
      });

      // Handle both JSON and text responses
      let responseData;
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        const textResponse = await response.text();
        console.log("📨 Webhook text response:", textResponse);
        responseData = { message: textResponse, status: "success" };
      }

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${JSON.stringify(responseData)}`
        );
      }

      console.log("✅ Webhook successful:", responseData);
      return true;
    } catch (error) {
      console.error("❌ Webhook failed:", error);
      // Don't break the user experience if webhook fails
      return false;
    }
  };

  const handleSaveChanges = async () => {
    setIsLoading(true);
    setSaveStatus("saving");

    try {
      // Update onboarding data with current profile changes
      const updatedOnboardingData = {
        ...profile.onboardingAnswers,
        contactEmail: profile.email,
        contactPhone: profile.phone,
        freeTimeSlots: profile.freeTime,
        contactMethod: profile.contactPreference,
      };

      const updatedProfile = {
        ...profile,
        onboardingAnswers: updatedOnboardingData,
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("userProfile", JSON.stringify(updatedProfile));
        localStorage.setItem(
          "OnBoarding",
          JSON.stringify(updatedOnboardingData)
        );
      }

      setProfile(updatedProfile);

      const webhookSuccess = await triggerN8nWebhook("profile_updated", {
        action: "profile_update",
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        timezone: profile.timezone,
        freeTime: profile.freeTime,
        contactPreference: profile.contactPreference,
        preferences: profile.preferences,
        updatedOnboardingAnswers: updatedOnboardingData,
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white rounded-2xl p-6 relative overflow-hidden font-sans">
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
          <div className="p-3 bg-white/10 rounded-2xl border-2 border-white/20">
            <User className="w-8 h-8 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent font-handwritten">
              Profile Settings
            </h1>
            <p className="text-gray-300 mt-2 font-handwritten">
              Manage your account, contact preferences, and conversation
              settings
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-md rounded-3xl border-2 border-white/20 p-6 shadow-2xl glow"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-400/30">
                  <User className="w-6 h-6 text-blue-300" />
                </div>
                <h2 className="text-2xl font-semibold font-handwritten">
                  Account Information
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-handwritten">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 font-handwritten"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-handwritten">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 font-handwritten"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-handwritten">
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
                      className="w-full p-3 pl-10 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 font-handwritten"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-handwritten">
                    Contact Preference
                  </label>
                  <select
                    value={profile.contactPreference}
                    onChange={(e) =>
                      handleInputChange("contactPreference", e.target.value)
                    }
                    className="w-full p-3 rounded-xl bg-white/10 border-2 border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 appearance-none font-handwritten"
                  >
                    <option value="email" className="bg-gray-800">
                      Email only
                    </option>
                    <option value="phone" className="bg-gray-800">
                      Phone only
                    </option>
                    <option value="both" className="bg-gray-800">
                      Both email and phone
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-handwritten">
                    Timezone
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <select
                      value={profile.timezone}
                      onChange={(e) =>
                        handleInputChange("timezone", e.target.value)
                      }
                      className="w-full p-3 pl-10 rounded-xl bg-white/10 border-2 border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-200 appearance-none font-handwritten"
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
              className="bg-white/10 backdrop-blur-md rounded-3xl border-2 border-white/20 p-6 shadow-2xl glow"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-green-500/20 border border-green-400/30">
                  <Clock className="w-6 h-6 text-green-300" />
                </div>
                <h2 className="text-2xl font-semibold font-handwritten">
                  Availability & Preferences
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 font-handwritten">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                    Free Time Slots
                  </h3>
                  <div className="space-y-2">
                    {freeTimeOptions.map((time) => (
                      <label
                        key={time}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer border border-white/10"
                      >
                        <input
                          type="checkbox"
                          checked={profile.freeTime.includes(time)}
                          onChange={() => handleFreeTimeToggle(time)}
                          className="w-4 h-4 text-cyan-500 bg-white/10 border-white/20 rounded focus:ring-cyan-500"
                        />
                        <span className="flex-1 font-handwritten">{time}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 font-handwritten">
                    <Bell className="w-5 h-5 text-pink-400" />
                    Check-in Preferences
                  </h3>
                  <div className="space-y-2">
                    {checkInOptions.map((time) => (
                      <label
                        key={time}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer border border-white/10"
                      >
                        <input
                          type="checkbox"
                          checked={profile.preferences.checkIns.includes(time)}
                          onChange={() => handleCheckInToggle(time)}
                          className="w-4 h-4 text-cyan-500 bg-white/10 border-white/20 rounded focus:ring-cyan-500"
                        />
                        <span className="flex-1 font-handwritten">{time}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/10 backdrop-blur-md rounded-3xl border-2 border-white/20 p-6 shadow-2xl glow"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-400/30">
                  <Settings className="w-6 h-6 text-purple-300" />
                </div>
                <h2 className="text-2xl font-semibold font-handwritten">
                  App Preferences
                </h2>
              </div>

              <div className="space-y-4">
                <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer border border-white/10">
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-green-400" />
                    <span className="font-handwritten">Call Reminders</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.preferences.callReminders}
                    onChange={(e) =>
                      handlePreferenceChange("callReminders", e.target.checked)
                    }
                    className="w-4 h-4 text-cyan-500 bg-white/10 border-white/20 rounded focus:ring-cyan-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer border border-white/10">
                  <div className="flex items-center gap-3">
                    <Heart className="w-5 h-5 text-pink-400" />
                    <span className="font-handwritten">Mood Tracking</span>
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

                <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer border border-white/10">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    <span className="font-handwritten">Session Progress</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.preferences.sessionProgress}
                    onChange={(e) =>
                      handlePreferenceChange(
                        "sessionProgress",
                        e.target.checked
                      )
                    }
                    className="w-4 h-4 text-cyan-500 bg-white/10 border-white/20 rounded focus:ring-cyan-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer border border-white/10">
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-yellow-400" />
                    <span className="font-handwritten">Context Awareness</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.preferences.contextAwareness}
                    onChange={(e) =>
                      handlePreferenceChange(
                        "contextAwareness",
                        e.target.checked
                      )
                    }
                    className="w-4 h-4 text-cyan-500 bg-white/10 border-white/20 rounded focus:ring-cyan-500"
                  />
                </label>
              </div>
            </motion.div>

            <motion.button
              onClick={handleSaveChanges}
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full p-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-2xl border-2 ${
                saveStatus === "success"
                  ? "bg-green-500 hover:bg-green-600 border-green-400"
                  : saveStatus === "error"
                  ? "bg-red-500 hover:bg-red-600 border-red-400"
                  : "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 border-cyan-400"
              } flex items-center justify-center gap-3 font-handwritten`}
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

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/10 backdrop-blur-md rounded-3xl border-2 border-white/20 p-6 shadow-2xl glow"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-yellow-500/20 border border-yellow-400/30">
                  <Brain className="w-6 h-6 text-yellow-300" />
                </div>
                <h3 className="text-lg font-semibold font-handwritten">
                  AI Context
                </h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300 font-handwritten">
                    Remembered Topics:
                  </span>
                  <span className="font-semibold font-handwritten">
                    {profile.conversationContext?.recentTopics?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300 font-handwritten">
                    Last Session:
                  </span>
                  <span className="font-semibold font-handwritten">
                    {profile.conversationContext?.lastSessionDate
                      ? new Date(
                          profile.conversationContext.lastSessionDate
                        ).toLocaleDateString()
                      : "Never"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300 font-handwritten">
                    Emotional State:
                  </span>
                  <span className="font-semibold font-handwritten capitalize">
                    {profile.conversationContext?.emotionalState || "neutral"}
                  </span>
                </div>
              </div>
            </motion.div>
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
